import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { ledgerEntries, transactions, wallets } from '../../database/schema';
import { SYSTEM_WALLET_KEYS, MVP_CURRENCY } from '../../common/constants';

export type LedgerLeg = {
  walletId: string;
  direction: 'debit' | 'credit';
  amount: bigint;
};

export type PostLedgerInput = {
  idempotencyKey: string;
  userId?: string | null;
  type:
    | 'fund'
    | 'payout'
    | 'transfer'
    | 'convert'
    | 'card_spend'
    | 'receive'
    | 'bill'
    | 'airtime'
    | 'stablecoin_deposit'
    | 'stablecoin_convert'
    | 'bulk_payout'
    | 'reversal'
    | 'adjustment';
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'reversed';
  amount: bigint;
  fee?: bigint;
  currency: string;
  sourceWalletId?: string | null;
  destWalletId?: string | null;
  beneficiaryId?: string | null;
  externalReference?: string | null;
  metadata?: Record<string, unknown>;
  legs: LedgerLeg[];
  /** When false, create txn row but skip ledger (e.g. pending payout hold later) */
  postEntries?: boolean;
};

@Injectable()
export class LedgerService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async ensureSystemWallets(currency: string = MVP_CURRENCY) {
    for (const key of Object.values(SYSTEM_WALLET_KEYS)) {
      const existing = await this.db.query.wallets.findFirst({
        where: and(eq(wallets.systemKey, key), eq(wallets.currency, currency)),
      });
      if (!existing) {
        await this.db.insert(wallets).values({
          ownerType: 'system',
          systemKey: key,
          currency,
          status: 'active',
        });
      }
    }
  }

  async getSystemWallet(systemKey: string, currency: string = MVP_CURRENCY) {
    await this.ensureSystemWallets(currency);
    const wallet = await this.db.query.wallets.findFirst({
      where: and(
        eq(wallets.systemKey, systemKey),
        eq(wallets.currency, currency),
      ),
    });
    if (!wallet) {
      throw new NotFoundException(`System wallet ${systemKey} missing`);
    }
    return wallet;
  }

  async getBalance(walletId: string): Promise<bigint> {
    const latest = await this.db.query.ledgerEntries.findFirst({
      where: eq(ledgerEntries.walletId, walletId),
      orderBy: [desc(ledgerEntries.createdAt), desc(ledgerEntries.id)],
    });
    return latest?.balanceAfter ?? 0n;
  }

  async post(input: PostLedgerInput) {
    if (input.amount < 0n) {
      throw new BadRequestException('Amount must be non-negative');
    }

    const existing = await this.db.query.transactions.findFirst({
      where: eq(transactions.idempotencyKey, input.idempotencyKey),
    });
    if (existing) {
      return existing;
    }

    const postEntries = input.postEntries !== false;
    if (postEntries) {
      await this.assertBalanced(input.legs);
    }

    try {
      return await this.db.transaction(async (tx) => {
        await tx.execute(
          sql`set local transaction isolation level serializable`,
        );

        const again = await tx.query.transactions.findFirst({
          where: eq(transactions.idempotencyKey, input.idempotencyKey),
        });
        if (again) return again;

        const [txn] = await tx
          .insert(transactions)
          .values({
            userId: input.userId ?? null,
            type: input.type,
            status: input.status ?? (postEntries ? 'completed' : 'pending'),
            amount: input.amount,
            fee: input.fee ?? 0n,
            currency: input.currency,
            sourceWalletId: input.sourceWalletId ?? null,
            destWalletId: input.destWalletId ?? null,
            beneficiaryId: input.beneficiaryId ?? null,
            idempotencyKey: input.idempotencyKey,
            externalReference: input.externalReference ?? null,
            metadata: input.metadata ?? {},
          })
          .returning();

        if (!postEntries) {
          return txn;
        }

        const walletIds = [
          ...new Set(input.legs.map((l) => l.walletId)),
        ].sort();
        const balances = new Map<string, bigint>();

        for (const walletId of walletIds) {
          const wallet = await tx.query.wallets.findFirst({
            where: eq(wallets.id, walletId),
          });
          if (!wallet) {
            throw new NotFoundException(`Wallet ${walletId} not found`);
          }
          if (wallet.status !== 'active') {
            throw new BadRequestException(`Wallet ${walletId} is not active`);
          }

          const latest = await tx.query.ledgerEntries.findFirst({
            where: eq(ledgerEntries.walletId, walletId),
            orderBy: [desc(ledgerEntries.createdAt), desc(ledgerEntries.id)],
          });
          balances.set(walletId, latest?.balanceAfter ?? 0n);
        }

        for (const leg of input.legs) {
          if (leg.amount <= 0n) {
            throw new BadRequestException('Ledger leg amount must be > 0');
          }
          const current = balances.get(leg.walletId) ?? 0n;
          const next =
            leg.direction === 'credit'
              ? current + leg.amount
              : current - leg.amount;

          const wallet = await tx.query.wallets.findFirst({
            where: eq(wallets.id, leg.walletId),
          });
          if (wallet?.ownerType === 'user' && next < 0n) {
            throw new BadRequestException('Insufficient wallet balance');
          }

          await tx.insert(ledgerEntries).values({
            walletId: leg.walletId,
            transactionId: txn.id,
            direction: leg.direction,
            amount: leg.amount,
            balanceAfter: next,
          });
          balances.set(leg.walletId, next);
        }

        return txn;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('transactions_idempotency_key_uidx')) {
        const dup = await this.db.query.transactions.findFirst({
          where: eq(transactions.idempotencyKey, input.idempotencyKey),
        });
        if (dup) return dup;
        throw new ConflictException('Duplicate idempotency key');
      }
      throw error;
    }
  }

  async updateStatus(
    transactionId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'reversed',
    patch?: { externalReference?: string; failureReason?: string },
  ) {
    const [updated] = await this.db
      .update(transactions)
      .set({
        status,
        externalReference: patch?.externalReference,
        failureReason: patch?.failureReason,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, transactionId))
      .returning();
    return updated;
  }

  /** Attach balanced ledger legs to an existing pending transaction and mark completed. */
  async completeWithEntries(
    transactionId: string,
    legs: LedgerLeg[],
    patch?: {
      externalReference?: string;
      fee?: bigint;
      metadata?: Record<string, unknown>;
    },
  ) {
    await this.assertBalanced(legs);

    return this.db.transaction(async (tx) => {
      await tx.execute(sql`set local transaction isolation level serializable`);

      const txn = await tx.query.transactions.findFirst({
        where: eq(transactions.id, transactionId),
      });
      if (!txn) throw new NotFoundException('Transaction not found');
      if (txn.status === 'completed') return txn;
      if (txn.status !== 'pending' && txn.status !== 'processing') {
        throw new BadRequestException(
          `Cannot complete transaction in status ${txn.status}`,
        );
      }

      const existingLegs = await tx.query.ledgerEntries.findMany({
        where: eq(ledgerEntries.transactionId, transactionId),
      });
      if (existingLegs.length > 0) {
        const [updated] = await tx
          .update(transactions)
          .set({
            status: 'completed',
            externalReference:
              patch?.externalReference ?? txn.externalReference,
            fee: patch?.fee ?? txn.fee,
            metadata: patch?.metadata
              ? { ...(txn.metadata ?? {}), ...patch.metadata }
              : txn.metadata,
            updatedAt: new Date(),
          })
          .where(eq(transactions.id, transactionId))
          .returning();
        return updated;
      }

      const walletIds = [...new Set(legs.map((l) => l.walletId))].sort();
      const balances = new Map<string, bigint>();

      for (const walletId of walletIds) {
        const wallet = await tx.query.wallets.findFirst({
          where: eq(wallets.id, walletId),
        });
        if (!wallet)
          throw new NotFoundException(`Wallet ${walletId} not found`);
        if (wallet.status !== 'active') {
          throw new BadRequestException(`Wallet ${walletId} is not active`);
        }
        const latest = await tx.query.ledgerEntries.findFirst({
          where: eq(ledgerEntries.walletId, walletId),
          orderBy: [desc(ledgerEntries.createdAt), desc(ledgerEntries.id)],
        });
        balances.set(walletId, latest?.balanceAfter ?? 0n);
      }

      for (const leg of legs) {
        const current = balances.get(leg.walletId) ?? 0n;
        const next =
          leg.direction === 'credit'
            ? current + leg.amount
            : current - leg.amount;
        const wallet = await tx.query.wallets.findFirst({
          where: eq(wallets.id, leg.walletId),
        });
        if (wallet?.ownerType === 'user' && next < 0n) {
          throw new BadRequestException('Insufficient wallet balance');
        }
        await tx.insert(ledgerEntries).values({
          walletId: leg.walletId,
          transactionId,
          direction: leg.direction,
          amount: leg.amount,
          balanceAfter: next,
        });
        balances.set(leg.walletId, next);
      }

      const [updated] = await tx
        .update(transactions)
        .set({
          status: 'completed',
          externalReference: patch?.externalReference ?? txn.externalReference,
          fee: patch?.fee ?? txn.fee,
          metadata: patch?.metadata
            ? { ...(txn.metadata ?? {}), ...patch.metadata }
            : txn.metadata,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, transactionId))
        .returning();
      return updated;
    });
  }

  /**
   * Legs must net to zero per currency (multi-currency FX journals allowed).
   */
  private async assertBalanced(legs: LedgerLeg[]) {
    const byCurrency = new Map<string, { debit: bigint; credit: bigint }>();

    for (const leg of legs) {
      const wallet = await this.db.query.wallets.findFirst({
        where: eq(wallets.id, leg.walletId),
      });
      if (!wallet) {
        throw new NotFoundException(`Wallet ${leg.walletId} not found`);
      }
      const bucket = byCurrency.get(wallet.currency) ?? {
        debit: 0n,
        credit: 0n,
      };
      if (leg.direction === 'debit') bucket.debit += leg.amount;
      else bucket.credit += leg.amount;
      byCurrency.set(wallet.currency, bucket);
    }

    for (const [currency, bucket] of byCurrency) {
      if (bucket.debit !== bucket.credit) {
        throw new BadRequestException(
          `Unbalanced ${currency} ledger: debit=${bucket.debit} credit=${bucket.credit}`,
        );
      }
    }
  }
}
