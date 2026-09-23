import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, gte, lt, inArray } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { transactions } from '../../database/schema';
import { FlutterwaveClient } from '../payments/rails/flutterwave.client';
import { REDIS } from '../../redis/redis.module';
import type Redis from 'ioredis';

export type ReconStatus =
  | 'matched'
  | 'amount_mismatch'
  | 'status_mismatch'
  | 'missing_external'
  | 'missing_local';

export type ReconItem = {
  status: ReconStatus;
  internalId?: string;
  externalRef?: string;
  internalAmountMinor?: string;
  externalAmountMinor?: string;
  internalStatus?: string;
  externalStatus?: string;
  currency?: string;
  type?: string;
  note?: string;
};

export type ReconciliationReport = {
  date: string;
  generatedAt: string;
  railConfigured: boolean;
  summary: Record<ReconStatus, number> & {
    totalInternal: number;
    totalExternal: number;
  };
  items: ReconItem[];
};

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly flw: FlutterwaveClient,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async reconcileDate(date: string): Promise<ReconciliationReport> {
    const { start, end } = this.dayBounds(date);
    const internal = await this.db.query.transactions.findMany({
      where: and(
        inArray(transactions.type, ['fund', 'payout']),
        gte(transactions.createdAt, start),
        lt(transactions.createdAt, end),
      ),
    });

    let external: Array<{
      id?: number;
      tx_ref?: string;
      flw_ref?: string;
      amount?: number;
      currency?: string;
      status?: string;
    }> = [];

    const railConfigured = this.flw.isConfigured();
    if (railConfigured) {
      try {
        external = await this.flw.listTransactions({
          from: date,
          to: date,
        });
      } catch (err) {
        this.logger.warn(
          `Flutterwave listTransactions failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    const byRef = new Map<string, (typeof external)[number]>();
    for (const ex of external) {
      if (ex.tx_ref) byRef.set(ex.tx_ref, ex);
      if (ex.flw_ref) byRef.set(ex.flw_ref, ex);
      if (ex.id != null) byRef.set(String(ex.id), ex);
    }

    const items: ReconItem[] = [];
    const claimedExternal = new Set<string>();

    for (const txn of internal) {
      const refs = [
        txn.externalReference,
        txn.idempotencyKey.replace(/^(fund|payout):/, ''),
        txn.idempotencyKey,
      ].filter((r): r is string => Boolean(r));

      let match: (typeof external)[number] | undefined;
      let matchKey: string | undefined;
      for (const ref of refs) {
        const hit = byRef.get(ref);
        if (hit) {
          match = hit;
          matchKey = ref;
          break;
        }
      }

      if (!match) {
        items.push({
          status: 'missing_external',
          internalId: txn.id,
          externalRef: txn.externalReference ?? undefined,
          internalAmountMinor: txn.amount.toString(),
          internalStatus: txn.status,
          currency: txn.currency,
          type: txn.type,
          note: railConfigured
            ? 'No matching Flutterwave transaction'
            : 'Flutterwave not configured — external side skipped',
        });
        continue;
      }

      if (matchKey) claimedExternal.add(matchKey);
      if (match.tx_ref) claimedExternal.add(match.tx_ref);
      if (match.flw_ref) claimedExternal.add(match.flw_ref);
      if (match.id != null) claimedExternal.add(String(match.id));

      const extMinor = BigInt(Math.round(Number(match.amount ?? 0) * 100));
      const extStatus = String(match.status ?? '').toLowerCase();
      const internalOk =
        txn.status === 'completed' || txn.status === 'processing';
      const externalOk =
        extStatus === 'successful' ||
        extStatus === 'success' ||
        extStatus === 'completed';

      if (extMinor !== txn.amount) {
        items.push({
          status: 'amount_mismatch',
          internalId: txn.id,
          externalRef: match.tx_ref ?? match.flw_ref,
          internalAmountMinor: txn.amount.toString(),
          externalAmountMinor: extMinor.toString(),
          internalStatus: txn.status,
          externalStatus: match.status,
          currency: txn.currency,
          type: txn.type,
        });
      } else if (internalOk !== externalOk && txn.status !== 'pending') {
        items.push({
          status: 'status_mismatch',
          internalId: txn.id,
          externalRef: match.tx_ref ?? match.flw_ref,
          internalAmountMinor: txn.amount.toString(),
          externalAmountMinor: extMinor.toString(),
          internalStatus: txn.status,
          externalStatus: match.status,
          currency: txn.currency,
          type: txn.type,
        });
      } else {
        items.push({
          status: 'matched',
          internalId: txn.id,
          externalRef: match.tx_ref ?? match.flw_ref,
          internalAmountMinor: txn.amount.toString(),
          externalAmountMinor: extMinor.toString(),
          internalStatus: txn.status,
          externalStatus: match.status,
          currency: txn.currency,
          type: txn.type,
        });
      }
    }

    for (const ex of external) {
      const keys = [
        ex.tx_ref,
        ex.flw_ref,
        ex.id != null ? String(ex.id) : null,
      ].filter((k): k is string => Boolean(k));
      if (keys.some((k) => claimedExternal.has(k))) continue;
      items.push({
        status: 'missing_local',
        externalRef: ex.tx_ref ?? ex.flw_ref ?? String(ex.id),
        externalAmountMinor: BigInt(
          Math.round(Number(ex.amount ?? 0) * 100),
        ).toString(),
        externalStatus: ex.status,
        currency: ex.currency,
        note: 'Present on Flutterwave but no local fund/payout match',
      });
    }

    const summary = {
      matched: 0,
      amount_mismatch: 0,
      status_mismatch: 0,
      missing_external: 0,
      missing_local: 0,
      totalInternal: internal.length,
      totalExternal: external.length,
    } satisfies ReconciliationReport['summary'];
    for (const item of items) {
      summary[item.status] += 1;
    }

    const report: ReconciliationReport = {
      date,
      generatedAt: new Date().toISOString(),
      railConfigured,
      summary,
      items,
    };

    await this.redis.set(
      `recon:report:${date}`,
      JSON.stringify(report),
      'EX',
      7 * 86_400,
    );

    return report;
  }

  async getCachedReport(date: string): Promise<ReconciliationReport | null> {
    const raw = await this.redis.get(`recon:report:${date}`);
    if (!raw) return null;
    return JSON.parse(raw) as ReconciliationReport;
  }

  private dayBounds(date: string): { start: Date; end: Date } {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('date must be YYYY-MM-DD');
    }
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }
}
