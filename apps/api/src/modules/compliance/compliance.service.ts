import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { transactions, users } from '../../database/schema';
import {
  KYC_LIMITS,
  type KycTier,
} from '../../common/constants';
import {
  SANCTIONS_PROVIDER,
  type SanctionsProvider,
} from './sanctions.interface';
import { AmlMonitorService } from './aml-monitor.service';
import { LedgerService } from '../ledger/ledger.service';
import { WalletsService } from '../ledger/wallets.service';

export type LimitCheckKind = 'fund' | 'payout';

@Injectable()
export class ComplianceService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(SANCTIONS_PROVIDER) private readonly sanctions: SanctionsProvider,
    private readonly aml: AmlMonitorService,
    private readonly ledger: LedgerService,
    private readonly wallets: WalletsService,
  ) {}

  getTierLimits(tier: string) {
    const key = (tier in KYC_LIMITS ? tier : 'tier_0') as KycTier;
    const limits = KYC_LIMITS[key];
    return {
      tier: key,
      maxSinglePayoutMinor: limits.maxSinglePayoutMinor.toString(),
      maxDailyPayoutMinor: limits.maxDailyPayoutMinor.toString(),
      maxMonthlyPayoutMinor: limits.maxMonthlyPayoutMinor.toString(),
      maxSingleFundMinor: limits.maxSingleFundMinor.toString(),
      maxDailyFundMinor: limits.maxDailyFundMinor.toString(),
      maxMonthlyFundMinor: limits.maxMonthlyFundMinor.toString(),
      maxWalletBalanceMinor: limits.maxWalletBalanceMinor.toString(),
    };
  }

  async getUserLimitsUsage(userId: string, currency: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) throw new NotFoundException('User not found');
    const tier = (user.kycTier in KYC_LIMITS ? user.kycTier : 'tier_0') as KycTier;
    const limits = KYC_LIMITS[tier];
    const { dayStart, monthStart, nextDay, nextMonth } = this.periodBounds();

    const [dailyPayout, monthlyPayout, dailyFund, monthlyFund] =
      await Promise.all([
        this.sumTxnAmount(userId, 'payout', dayStart, nextDay),
        this.sumTxnAmount(userId, 'payout', monthStart, nextMonth),
        this.sumTxnAmount(userId, 'fund', dayStart, nextDay),
        this.sumTxnAmount(userId, 'fund', monthStart, nextMonth),
      ]);

    let walletBalanceMinor = '0';
    try {
      const wallet = await this.wallets.getUserWalletOrThrow(userId, currency);
      walletBalanceMinor = (await this.ledger.getBalance(wallet.id)).toString();
    } catch {
      walletBalanceMinor = '0';
    }

    return {
      ...this.getTierLimits(tier),
      currency,
      usage: {
        dailyPayoutMinor: dailyPayout.toString(),
        monthlyPayoutMinor: monthlyPayout.toString(),
        dailyFundMinor: dailyFund.toString(),
        monthlyFundMinor: monthlyFund.toString(),
        walletBalanceMinor,
      },
      openAlerts: await this.aml.openAlertCount(userId),
    };
  }

  /**
   * Enforce single + rolling daily/monthly KYC tier limits.
   * For fund, also checks projected wallet balance when provided.
   */
  async checkLimits(input: {
    userId: string;
    tier: string;
    kind: LimitCheckKind;
    amountMinor: bigint;
    currency: string;
    projectedWalletBalance?: bigint;
  }) {
    const tier = (
      input.tier in KYC_LIMITS ? input.tier : 'tier_0'
    ) as KycTier;
    const limits = KYC_LIMITS[tier];
    const { dayStart, monthStart, nextDay, nextMonth } = this.periodBounds();

    if (input.kind === 'payout') {
      if (input.amountMinor > limits.maxSinglePayoutMinor) {
        throw new ForbiddenException(
          `Payout exceeds ${tier} single limit. Complete KYC to raise limits.`,
        );
      }
      const daily = await this.sumTxnAmount(
        input.userId,
        'payout',
        dayStart,
        nextDay,
      );
      if (daily + input.amountMinor > limits.maxDailyPayoutMinor) {
        throw new ForbiddenException(
          `Payout would exceed ${tier} daily payout limit`,
        );
      }
      const monthly = await this.sumTxnAmount(
        input.userId,
        'payout',
        monthStart,
        nextMonth,
      );
      if (monthly + input.amountMinor > limits.maxMonthlyPayoutMinor) {
        throw new ForbiddenException(
          `Payout would exceed ${tier} monthly payout limit`,
        );
      }
      return;
    }

    if (input.amountMinor > limits.maxSingleFundMinor) {
      throw new ForbiddenException(
        `Fund exceeds ${tier} single limit. Complete KYC to raise limits.`,
      );
    }
    const daily = await this.sumTxnAmount(
      input.userId,
      'fund',
      dayStart,
      nextDay,
    );
    if (daily + input.amountMinor > limits.maxDailyFundMinor) {
      throw new ForbiddenException(
        `Fund would exceed ${tier} daily funding limit`,
      );
    }
    const monthly = await this.sumTxnAmount(
      input.userId,
      'fund',
      monthStart,
      nextMonth,
    );
    if (monthly + input.amountMinor > limits.maxMonthlyFundMinor) {
      throw new ForbiddenException(
        `Fund would exceed ${tier} monthly funding limit`,
      );
    }
    if (
      input.projectedWalletBalance != null &&
      input.projectedWalletBalance > limits.maxWalletBalanceMinor
    ) {
      throw new ForbiddenException('Funding would exceed KYC wallet limit');
    }
  }

  async screenInbound(input: {
    userId: string;
    amountMinor: bigint;
    currency: string;
    senderName?: string;
    transactionId?: string;
  }) {
    const result = await this.sanctions.checkName(
      input.senderName ?? 'unknown',
      undefined,
    );
    if (!result.cleared) {
      await this.aml.flag({
        userId: input.userId,
        transactionId: input.transactionId,
        ruleName: 'sanctions_hit',
        severity: 'critical',
        description: result.matchDetails ?? 'Inbound sanctions match',
        metadata: { provider: result.provider, score: result.score },
      });
      return {
        cleared: false,
        reviewQueued: true,
        provider: result.provider,
        score: result.score,
      };
    }

    const alert = await this.aml.maybeFlagLargeAmount({
      userId: input.userId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      direction: 'inbound',
      transactionId: input.transactionId,
    });

    return {
      cleared: true,
      reviewQueued: Boolean(alert),
      provider: result.provider,
      score: result.score,
    };
  }

  async screenPayout(input: {
    userId: string;
    amountMinor: bigint;
    currency: string;
    country: string;
    beneficiaryName?: string;
    transactionId?: string;
  }) {
    const result = await this.sanctions.checkName(
      input.beneficiaryName ?? 'unknown',
      input.country,
    );
    if (!result.cleared) {
      await this.aml.flag({
        userId: input.userId,
        transactionId: input.transactionId,
        ruleName: 'sanctions_hit',
        severity: 'critical',
        description: result.matchDetails ?? 'Payout sanctions match',
        metadata: {
          provider: result.provider,
          score: result.score,
          country: input.country,
        },
      });
      return {
        cleared: false,
        reviewQueued: true,
        provider: result.provider,
        score: result.score,
      };
    }

    const alert = await this.aml.maybeFlagLargeAmount({
      userId: input.userId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      direction: 'outbound',
      transactionId: input.transactionId,
    });

    return {
      cleared: true,
      reviewQueued: Boolean(alert),
      provider: result.provider,
      score: result.score,
    };
  }

  private periodBounds(now = new Date()) {
    const dayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const nextDay = new Date(dayStart);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const nextMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
    return { dayStart, nextDay, monthStart, nextMonth };
  }

  private async sumTxnAmount(
    userId: string,
    type: 'fund' | 'payout',
    from: Date,
    to: Date,
  ): Promise<bigint> {
    const rows = await this.db
      .select({
        total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, type),
          inArray(transactions.status, [
            'pending',
            'processing',
            'completed',
          ]),
          gte(transactions.createdAt, from),
          lt(transactions.createdAt, to),
        ),
      );
    return BigInt(rows[0]?.total ?? '0');
  }
}
