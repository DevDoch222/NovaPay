import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { users, virtualAccounts } from '../../database/schema';
import {
  CURRENCY_DECIMALS,
  EUR_CURRENCY,
  SYSTEM_WALLET_KEYS,
  USD_CURRENCY,
} from '../../common/constants';
import { LedgerService } from '../ledger/ledger.service';
import { WalletsService } from '../ledger/wallets.service';
import { MockBaasProvider } from './mock-baas.provider';
import { NotificationsService } from '../notifications/notifications.service';
import { ComplianceService } from '../compliance/compliance.service';
import {
  buildPaginatedResult,
  paginationOffset,
} from '../../common/api/pagination.util';

@Injectable()
export class ReceiveService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly baas: MockBaasProvider,
    private readonly ledger: LedgerService,
    private readonly wallets: WalletsService,
    private readonly notifications: NotificationsService,
    private readonly compliance: ComplianceService,
  ) {}

  async createVirtualAccount(userId: string, currency: 'USD' | 'EUR') {
    if (currency !== USD_CURRENCY && currency !== EUR_CURRENCY) {
      throw new BadRequestException('Only USD or EUR virtual accounts');
    }

    const existing = await this.db.query.virtualAccounts.findFirst({
      where: and(
        eq(virtualAccounts.userId, userId),
        eq(virtualAccounts.currency, currency),
        eq(virtualAccounts.status, 'active'),
      ),
    });
    if (existing) return this.serialize(existing);

    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    const accountName = user?.tag
      ? `NovaPay / ${user.tag}`
      : 'NovaPay Customer';

    const wallet = await this.wallets.ensureUserWallet(userId, currency);
    const issued = await this.baas.issueVirtualAccount({
      userId,
      currency,
      accountName,
    });

    const [row] = await this.db
      .insert(virtualAccounts)
      .values({
        userId,
        walletId: wallet.id,
        currency,
        provider: issued.provider,
        providerRef: issued.providerRef,
        accountNumber: issued.accountNumber,
        routingNumber: issued.routingNumber,
        iban: issued.iban,
        bic: issued.bic,
        bankName: issued.bankName,
        accountName: issued.accountName,
        country: issued.country,
        status: 'active',
        metadata: { rails: currency === 'USD' ? 'ACH/wire' : 'SEPA' },
      })
      .returning();

    return this.serialize(row);
  }

  async listVirtualAccounts(userId: string, page = 1, limit = 50) {
    const where = and(
      eq(virtualAccounts.userId, userId),
      eq(virtualAccounts.status, 'active'),
    );
    const offset = paginationOffset(page, limit);
    const [rows, countRows] = await Promise.all([
      this.db.query.virtualAccounts.findMany({
        where,
        orderBy: [desc(virtualAccounts.createdAt)],
        limit,
        offset,
      }),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(virtualAccounts)
        .where(where),
    ]);
    const items = rows.map((r) => this.serialize(r));
    return buildPaginatedResult(items, page, limit, countRows[0]?.count ?? 0);
  }

  async getOwnedVirtualAccount(userId: string, id: string) {
    const row = await this.db.query.virtualAccounts.findFirst({
      where: and(
        eq(virtualAccounts.id, id),
        eq(virtualAccounts.userId, userId),
      ),
    });
    if (!row) throw new NotFoundException('Virtual account not found');
    return this.serialize(row);
  }

  /**
   * Sandbox / BaaS webhook: credit matching virtual account wallet.
   */
  async creditInbound(input: {
    providerRef?: string;
    accountNumber?: string;
    amountMajor: number;
    currency: string;
    externalReference: string;
    senderName?: string;
  }) {
    const va = await this.findVirtualAccount(input);
    if (!va) {
      throw new NotFoundException('Virtual account not found');
    }

    const decimals = CURRENCY_DECIMALS[input.currency] ?? 2;
    const amountMinor = BigInt(Math.round(input.amountMajor * 10 ** decimals));
    if (amountMinor <= 0n) {
      throw new BadRequestException('Invalid inbound amount');
    }
    if (va.currency !== input.currency) {
      throw new BadRequestException('Currency mismatch for virtual account');
    }

    const screen = await this.compliance.screenInbound({
      userId: va.userId,
      amountMinor,
      currency: input.currency,
      senderName: input.senderName,
    });
    if (!screen.cleared) {
      throw new BadRequestException('Inbound blocked by compliance screening');
    }

    const clearing = await this.ledger.getSystemWallet(
      SYSTEM_WALLET_KEYS.CLEARING_INBOUND,
      input.currency,
    );

    const txn = await this.ledger.post({
      idempotencyKey: `receive:${input.externalReference}`,
      userId: va.userId,
      type: 'receive',
      status: 'completed',
      amount: amountMinor,
      currency: input.currency,
      sourceWalletId: clearing.id,
      destWalletId: va.walletId,
      externalReference: input.externalReference,
      metadata: {
        virtualAccountId: va.id,
        providerRef: va.providerRef,
        senderName: input.senderName ?? null,
        rail: va.currency === 'USD' ? 'ACH/wire' : 'SEPA',
      },
      legs: [
        { walletId: clearing.id, direction: 'debit', amount: amountMinor },
        { walletId: va.walletId, direction: 'credit', amount: amountMinor },
      ],
    });

    await this.notifications.notify(va.userId, 'receive.completed', {
      transactionId: txn.id,
      amountMinor: amountMinor.toString(),
      currency: input.currency,
    });

    return {
      transactionId: txn.id,
      status: txn.status,
      amountMinor: amountMinor.toString(),
      currency: input.currency,
      balanceMinor: (await this.ledger.getBalance(va.walletId)).toString(),
      virtualAccountId: va.id,
    };
  }

  private async findVirtualAccount(input: {
    providerRef?: string;
    accountNumber?: string;
  }) {
    if (input.providerRef) {
      return this.db.query.virtualAccounts.findFirst({
        where: eq(virtualAccounts.providerRef, input.providerRef),
      });
    }
    if (input.accountNumber) {
      return this.db.query.virtualAccounts.findFirst({
        where: and(
          eq(virtualAccounts.accountNumber, input.accountNumber),
          eq(virtualAccounts.status, 'active'),
        ),
      });
    }
    return undefined;
  }

  private serialize(row: typeof virtualAccounts.$inferSelect) {
    return {
      id: row.id,
      currency: row.currency,
      accountNumber: row.accountNumber,
      routingNumber: row.routingNumber,
      iban: row.iban,
      bic: row.bic,
      bankName: row.bankName,
      accountName: row.accountName,
      country: row.country,
      provider: row.provider,
      providerRef: row.providerRef,
      status: row.status,
      instructions:
        row.currency === 'USD'
          ? 'Share account + routing for ACH/wire from US clients'
          : 'Share IBAN + BIC for SEPA transfers',
      createdAt: row.createdAt,
    };
  }
}
