import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { cardDisputes, cards, transactions } from '../../database/schema';
import { SYSTEM_WALLET_KEYS, USD_CURRENCY } from '../../common/constants';
import { LedgerService } from '../ledger/ledger.service';
import { AmlMonitorService } from './aml-monitor.service';
import {
  buildPaginatedResult,
  paginationOffset,
} from '../../common/api/pagination.util';

@Injectable()
export class DisputeService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly ledger: LedgerService,
    private readonly aml: AmlMonitorService,
  ) {}

  async open(input: {
    userId: string;
    cardId: string;
    transactionId: string;
    reason: string;
  }) {
    const card = await this.db.query.cards.findFirst({
      where: and(
        eq(cards.id, input.cardId),
        eq(cards.userId, input.userId),
      ),
    });
    if (!card) throw new NotFoundException('Card not found');

    const txn = await this.db.query.transactions.findFirst({
      where: eq(transactions.id, input.transactionId),
    });
    if (
      !txn ||
      txn.userId !== input.userId ||
      txn.type !== 'card_spend'
    ) {
      throw new NotFoundException('Card transaction not found');
    }

    const existing = await this.db.query.cardDisputes.findFirst({
      where: and(
        eq(cardDisputes.transactionId, input.transactionId),
        eq(cardDisputes.userId, input.userId),
      ),
    });
    if (existing && existing.status !== 'lost') {
      throw new BadRequestException('Dispute already open for this transaction');
    }

    const [row] = await this.db
      .insert(cardDisputes)
      .values({
        userId: input.userId,
        cardId: input.cardId,
        transactionId: input.transactionId,
        amount: txn.amount,
        currency: txn.currency,
        reason: input.reason,
        status: 'open',
        evidence: {
          merchant: (txn.metadata as Record<string, unknown>)?.merchant,
          last4: card.last4,
        },
      })
      .returning();

    await this.aml.flag({
      userId: input.userId,
      transactionId: input.transactionId,
      ruleName: 'card_dispute_opened',
      severity: 'medium',
      description: `Card dispute opened: ${input.reason}`,
      metadata: { disputeId: row.id, cardId: input.cardId },
    });

    return this.serialize(row);
  }

  async listForUser(userId: string, page = 1, limit = 50) {
    const where = eq(cardDisputes.userId, userId);
    const offset = paginationOffset(page, limit);
    const [items, countRow] = await Promise.all([
      this.db.query.cardDisputes.findMany({
        where,
        orderBy: [desc(cardDisputes.createdAt)],
        limit,
        offset,
      }),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(cardDisputes)
        .where(where),
    ]);

    return buildPaginatedResult(
      items.map((d) => this.serialize(d)),
      page,
      limit,
      countRow[0]?.count ?? 0,
    );
  }

  async getForUser(userId: string, disputeId: string) {
    const row = await this.db.query.cardDisputes.findFirst({
      where: and(
        eq(cardDisputes.id, disputeId),
        eq(cardDisputes.userId, userId),
      ),
    });
    if (!row) throw new NotFoundException('Dispute not found');
    return this.serialize(row);
  }

  async resolve(input: {
    disputeId: string;
    outcome: 'won' | 'lost';
    resolutionNote?: string;
  }) {
    const dispute = await this.db.query.cardDisputes.findFirst({
      where: eq(cardDisputes.id, input.disputeId),
    });
    if (!dispute) throw new NotFoundException('Dispute not found');
    if (!['open', 'under_investigation'].includes(dispute.status)) {
      throw new BadRequestException(`Dispute already ${dispute.status}`);
    }

    if (input.outcome === 'lost') {
      const [row] = await this.db
        .update(cardDisputes)
        .set({
          status: 'lost',
          resolutionNote: input.resolutionNote ?? null,
          updatedAt: new Date(),
        })
        .where(eq(cardDisputes.id, dispute.id))
        .returning();
      return this.serialize(row);
    }

    const txn = await this.db.query.transactions.findFirst({
      where: eq(transactions.id, dispute.transactionId),
    });
    if (!txn) throw new NotFoundException('Disputed transaction missing');

    const card = await this.db.query.cards.findFirst({
      where: eq(cards.id, dispute.cardId),
    });
    if (!card) throw new NotFoundException('Card missing');

    const sourceKey =
      txn.status === 'completed'
        ? SYSTEM_WALLET_KEYS.CARD_SETTLEMENT
        : SYSTEM_WALLET_KEYS.CARD_HOLDS;

    const source = await this.ledger.getSystemWallet(
      sourceKey,
      dispute.currency || USD_CURRENCY,
    );

    await this.ledger.post({
      idempotencyKey: `dispute_win:${dispute.id}`,
      userId: dispute.userId,
      type: 'reversal',
      status: 'completed',
      amount: dispute.amount,
      currency: dispute.currency,
      sourceWalletId: source.id,
      destWalletId: card.walletId,
      metadata: {
        disputeId: dispute.id,
        originalTransactionId: dispute.transactionId,
        reason: dispute.reason,
      },
      legs: [
        {
          walletId: source.id,
          direction: 'debit',
          amount: dispute.amount,
        },
        {
          walletId: card.walletId,
          direction: 'credit',
          amount: dispute.amount,
        },
      ],
    });

    await this.ledger.updateStatus(txn.id, 'reversed');

    const [row] = await this.db
      .update(cardDisputes)
      .set({
        status: 'reversed',
        resolutionNote: input.resolutionNote ?? 'Customer won — ledger reversed',
        updatedAt: new Date(),
      })
      .where(eq(cardDisputes.id, dispute.id))
      .returning();

    return this.serialize(row);
  }

  private serialize(row: typeof cardDisputes.$inferSelect) {
    return {
      id: row.id,
      userId: row.userId,
      cardId: row.cardId,
      transactionId: row.transactionId,
      amountMinor: row.amount.toString(),
      currency: row.currency,
      reason: row.reason,
      status: row.status,
      evidence: row.evidence ?? {},
      resolutionNote: row.resolutionNote,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
