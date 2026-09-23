import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { cards, transactions } from '../../database/schema';
import {
  CURRENCY_DECIMALS,
  SYSTEM_WALLET_KEYS,
  USD_CURRENCY,
} from '../../common/constants';
import { LedgerService } from '../ledger/ledger.service';
import { WalletsService } from '../ledger/wallets.service';
import { MockCardIssuer } from './mock-card-issuer';
import { NotificationsService } from '../notifications/notifications.service';
import { VelocityService } from '../compliance/velocity.service';
import {
  buildPaginatedResult,
  paginationOffset,
} from '../../common/api/pagination.util';

@Injectable()
export class CardsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly issuer: MockCardIssuer,
    private readonly ledger: LedgerService,
    private readonly wallets: WalletsService,
    private readonly notifications: NotificationsService,
    private readonly velocity: VelocityService,
  ) {}

  async issue(
    userId: string,
    input: {
      label?: string;
      spendLimitMajor?: number;
      form?: 'virtual' | 'physical';
      shippingName?: string;
      shippingLine1?: string;
      shippingCity?: string;
      shippingCountry?: string;
      shippingPostal?: string;
    },
  ) {
    const form = input.form ?? 'virtual';
    if (form === 'physical') {
      if (
        !input.shippingName ||
        !input.shippingLine1 ||
        !input.shippingCity ||
        !input.shippingCountry ||
        !input.shippingPostal
      ) {
        throw new BadRequestException(
          'Physical cards require full shipping address',
        );
      }
    }

    const wallet = await this.wallets.ensureUserWallet(userId, USD_CURRENCY);
    const issued = await this.issuer.issue({
      userId,
      currency: USD_CURRENCY,
      label: input.label,
      form,
    });

    const spendLimitMinor =
      input.spendLimitMajor != null
        ? BigInt(
            Math.round(
              input.spendLimitMajor * 10 ** (CURRENCY_DECIMALS.USD ?? 2),
            ),
          )
        : null;

    const [card] = await this.db
      .insert(cards)
      .values({
        userId,
        walletId: wallet.id,
        processorRef: issued.processorRef,
        brand: issued.brand,
        last4: issued.last4,
        expMonth: issued.expMonth,
        expYear: issued.expYear,
        status: 'active',
        form,
        currency: USD_CURRENCY,
        spendLimitMinor,
        label: input.label,
        shippingName: input.shippingName,
        shippingLine1: input.shippingLine1,
        shippingCity: input.shippingCity,
        shippingCountry: input.shippingCountry,
        shippingPostal: input.shippingPostal,
        fulfillmentStatus: form === 'physical' ? 'pending_print' : null,
        metadata: { issuer: this.issuer.name },
      })
      .returning();

    await this.notifications.notify(userId, 'card.issued', {
      cardId: card.id,
      last4: card.last4,
      form,
    });

    return this.serialize(card);
  }

  async list(userId: string, page = 1, limit = 50) {
    const where = eq(cards.userId, userId);
    const offset = paginationOffset(page, limit);
    const [rows, countRows] = await Promise.all([
      this.db.query.cards.findMany({
        where,
        orderBy: [desc(cards.createdAt)],
        limit,
        offset,
      }),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(cards)
        .where(where),
    ]);
    const items = rows.map((c) => this.serialize(c));
    return buildPaginatedResult(items, page, limit, countRows[0]?.count ?? 0);
  }

  async freeze(userId: string, cardId: string) {
    return this.setStatus(userId, cardId, 'frozen');
  }

  async unfreeze(userId: string, cardId: string) {
    return this.setStatus(userId, cardId, 'active');
  }

  async close(userId: string, cardId: string) {
    return this.setStatus(userId, cardId, 'closed');
  }

  /**
   * Sandbox: authorization places a hold (debit user USD → card_holds).
   */
  async authorize(input: {
    userId: string;
    cardId: string;
    amountMajor: number;
    merchant: string;
    idempotencyKey: string;
  }) {
    const card = await this.getOwnedCard(input.userId, input.cardId);
    if (card.status !== 'active') {
      throw new BadRequestException(`Card is ${card.status}`);
    }

    const amountMinor = BigInt(
      Math.round(input.amountMajor * 10 ** (CURRENCY_DECIMALS.USD ?? 2)),
    );
    if (card.spendLimitMinor != null && amountMinor > card.spendLimitMinor) {
      throw new BadRequestException('Amount exceeds card spend limit');
    }

    await this.velocity.checkCardAuth(input.userId);

    const balance = await this.ledger.getBalance(card.walletId);
    if (balance < amountMinor) {
      throw new BadRequestException('Insufficient USD wallet balance');
    }

    const holds = await this.ledger.getSystemWallet(
      SYSTEM_WALLET_KEYS.CARD_HOLDS,
      USD_CURRENCY,
    );

    const txn = await this.ledger.post({
      idempotencyKey: `card_auth:${input.idempotencyKey}`,
      userId: input.userId,
      type: 'card_spend',
      status: 'processing',
      amount: amountMinor,
      currency: USD_CURRENCY,
      sourceWalletId: card.walletId,
      destWalletId: holds.id,
      externalReference: card.processorRef,
      metadata: {
        phase: 'authorization',
        cardId: card.id,
        merchant: input.merchant,
        last4: card.last4,
      },
      legs: [
        { walletId: card.walletId, direction: 'debit', amount: amountMinor },
        { walletId: holds.id, direction: 'credit', amount: amountMinor },
      ],
    });

    return {
      authorizationId: txn.id,
      status: txn.status,
      amountMinor: amountMinor.toString(),
      currency: USD_CURRENCY,
      merchant: input.merchant,
      balanceMinor: (await this.ledger.getBalance(card.walletId)).toString(),
    };
  }

  /**
   * Sandbox: settlement moves hold → card_settlement and marks completed.
   */
  async settle(userId: string, authorizationId: string) {
    const txn = await this.db.query.transactions.findFirst({
      where: eq(transactions.id, authorizationId),
    });
    if (!txn || txn.userId !== userId || txn.type !== 'card_spend') {
      throw new NotFoundException('Authorization not found');
    }
    if (txn.status === 'completed') {
      return {
        id: txn.id,
        status: txn.status,
        amountMinor: txn.amount.toString(),
      };
    }
    if (txn.status !== 'processing') {
      throw new BadRequestException(`Cannot settle status ${txn.status}`);
    }

    const holds = await this.ledger.getSystemWallet(
      SYSTEM_WALLET_KEYS.CARD_HOLDS,
      USD_CURRENCY,
    );
    const settlement = await this.ledger.getSystemWallet(
      SYSTEM_WALLET_KEYS.CARD_SETTLEMENT,
      USD_CURRENCY,
    );

    const settleTxn = await this.ledger.post({
      idempotencyKey: `card_settle:${txn.id}`,
      userId,
      type: 'card_spend',
      status: 'completed',
      amount: txn.amount,
      currency: USD_CURRENCY,
      sourceWalletId: holds.id,
      destWalletId: settlement.id,
      externalReference: txn.externalReference,
      metadata: {
        phase: 'settlement',
        authorizationId: txn.id,
        ...(txn.metadata as Record<string, unknown>),
      },
      legs: [
        { walletId: holds.id, direction: 'debit', amount: txn.amount },
        { walletId: settlement.id, direction: 'credit', amount: txn.amount },
      ],
    });

    await this.ledger.updateStatus(txn.id, 'completed');

    await this.notifications.notify(userId, 'card.settled', {
      authorizationId: txn.id,
      settlementId: settleTxn.id,
    });

    return {
      authorizationId: txn.id,
      settlementId: settleTxn.id,
      status: 'completed',
      amountMinor: txn.amount.toString(),
      currency: USD_CURRENCY,
    };
  }

  private async setStatus(
    userId: string,
    cardId: string,
    status: 'active' | 'frozen' | 'closed',
  ) {
    const card = await this.getOwnedCard(userId, cardId);
    if (card.status === 'closed') {
      throw new BadRequestException('Card is closed');
    }
    const [updated] = await this.db
      .update(cards)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(cards.id, cardId), eq(cards.userId, userId)))
      .returning();
    return this.serialize(updated);
  }

  private async getOwnedCard(userId: string, cardId: string) {
    const card = await this.db.query.cards.findFirst({
      where: and(eq(cards.id, cardId), eq(cards.userId, userId)),
    });
    if (!card) throw new NotFoundException('Card not found');
    return card;
  }

  private serialize(card: typeof cards.$inferSelect) {
    return {
      id: card.id,
      brand: card.brand,
      last4: card.last4,
      expMonth: card.expMonth,
      expYear: card.expYear,
      status: card.status,
      form: card.form,
      currency: card.currency,
      walletId: card.walletId,
      spendLimitMinor: card.spendLimitMinor?.toString() ?? null,
      label: card.label,
      fulfillmentStatus: card.fulfillmentStatus,
      shipping:
        card.form === 'physical'
          ? {
              name: card.shippingName,
              line1: card.shippingLine1,
              city: card.shippingCity,
              country: card.shippingCountry,
              postal: card.shippingPostal,
            }
          : null,
      processorRef: card.processorRef,
      createdAt: card.createdAt,
    };
  }
}
