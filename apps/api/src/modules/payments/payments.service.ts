import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { beneficiaries, transactions, users } from '../../database/schema';
import {
  MVP_COUNTRY,
  MVP_CURRENCY,
  SYSTEM_WALLET_KEYS,
  type KycTier,
} from '../../common/constants';
import { LedgerService } from '../ledger/ledger.service';
import { WalletsService } from '../ledger/wallets.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  PAYMENT_RAIL,
  type PaymentRailProvider,
} from './rails/payment-rail.interface';
import { FlutterwaveClient } from './rails/flutterwave.client';
import { ComplianceService } from '../compliance/compliance.service';
import { VelocityService } from '../compliance/velocity.service';
import { FeesService } from '../fees/fees.service';
import { AuthService } from '../auth/auth.service';
import type { Env } from '../../config/env.validation';
import type {
  CreateBeneficiaryDto,
  CreatePayoutDto,
  FundWalletDto,
} from './dto';
import {
  buildPaginatedResult,
  paginationOffset,
} from '../../common/api/pagination.util';

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly ledger: LedgerService,
    private readonly wallets: WalletsService,
    @Inject(PAYMENT_RAIL) private readonly rail: PaymentRailProvider,
    private readonly notifications: NotificationsService,
    private readonly flw: FlutterwaveClient,
    private readonly config: ConfigService<Env, true>,
    private readonly compliance: ComplianceService,
    private readonly velocity: VelocityService,
    private readonly fees: FeesService,
    private readonly auth: AuthService,
  ) {}

  getRailName() {
    return this.rail.name;
  }

  async listNgBanks() {
    if (!this.flw.isConfigured()) {
      throw new BadRequestException('Flutterwave is not configured');
    }
    return this.flw.getBanks('NG');
  }

  async createBeneficiary(userId: string, dto: CreateBeneficiaryDto) {
    if (dto.type === 'mobile_money' && !dto.provider) {
      throw new BadRequestException(
        'provider is required for mobile_money (mtn|airtel|mpesa|vodafone)',
      );
    }

    const country = dto.country ?? MVP_COUNTRY;
    const currency =
      dto.currency ??
      (country === 'KE' ? 'KES' : country === 'GH' ? 'GHS' : MVP_CURRENCY);

    // Phase 3: MoMo in KE/GH catalogs exist; wallet payout still settles in NGN sandbox
    // when local currency wallet is not funded — debit NGN for NG MoMo, else try currency.
    const [row] = await this.db
      .insert(beneficiaries)
      .values({
        userId,
        type: dto.type,
        country,
        currency:
          currency === 'KES' || currency === 'GHS' ? MVP_CURRENCY : currency,
        accountName: dto.accountName,
        accountNumber: dto.accountNumber,
        bankCode: dto.bankCode,
        bankName: dto.bankName,
        provider: dto.provider,
        label: dto.label,
      })
      .returning();
    return row;
  }

  async listBeneficiaries(userId: string, page = 1, limit = 50) {
    const where = and(
      eq(beneficiaries.userId, userId),
      eq(beneficiaries.isActive, true),
    );
    const offset = paginationOffset(page, limit);
    const [rows, countRows] = await Promise.all([
      this.db.query.beneficiaries.findMany({
        where,
        orderBy: [desc(beneficiaries.createdAt)],
        limit,
        offset,
      }),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(beneficiaries)
        .where(where),
    ]);
    return buildPaginatedResult(rows, page, limit, countRows[0]?.count ?? 0);
  }

  async fundWallet(userId: string, dto: FundWalletDto) {
    const currency = dto.currency ?? MVP_CURRENCY;
    if (currency !== MVP_CURRENCY) {
      throw new BadRequestException(`Phase 1 only supports ${MVP_CURRENCY}`);
    }

    const amountMinor = BigInt(dto.amountMajor) * 100n;
    const feeQuote = this.fees.quote('fund', amountMinor, currency);
    const feeMinor = BigInt(feeQuote.feeMinor);
    const userWallet = await this.wallets.ensureUserWallet(userId, currency);
    const clearing = await this.ledger.getSystemWallet(
      SYSTEM_WALLET_KEYS.CLEARING_INBOUND,
      currency,
    );
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    const tier = (user?.kycTier ?? 'tier_0') as KycTier;
    const current = await this.ledger.getBalance(userWallet.id);
    const creditMinor = BigInt(feeQuote.netMinor);
    await this.compliance.checkLimits({
      userId,
      tier,
      kind: 'fund',
      amountMinor,
      currency,
      projectedWalletBalance: current + creditMinor,
    });

    const railResult = await this.rail.initiateCollection({
      amountMinor,
      currency,
      userId,
      reference: dto.idempotencyKey,
      customerPhone: user?.phone ?? undefined,
      customerEmail: user?.email ?? undefined,
      customerName: user?.tag ?? undefined,
    });

    const txn = await this.ledger.post({
      idempotencyKey: `fund:${dto.idempotencyKey}`,
      userId,
      type: 'fund',
      status: 'pending',
      amount: amountMinor,
      fee: feeMinor,
      currency,
      destWalletId: userWallet.id,
      sourceWalletId: clearing.id,
      externalReference: railResult.providerRef,
      metadata: {
        rail: this.rail.name,
        amountMajor: dto.amountMajor,
        paymentLink: railResult.paymentLink,
        fee: feeQuote,
      },
      legs: [],
      postEntries: false,
    });

    return {
      id: txn.id,
      status: txn.status,
      amountMinor: txn.amount.toString(),
      feeMinor: feeMinor.toString(),
      creditMinor: feeQuote.netMinor,
      currency: txn.currency,
      fee: feeQuote,
      rail: this.rail.name,
      externalReference: txn.externalReference,
      paymentLink: railResult.paymentLink,
      nextStep:
        this.rail.name === 'flutterwave'
          ? 'Open paymentLink, pay, then wallet credits via webhook (or call simulate-complete in test)'
          : 'POST /v1/payments/fund/:id/simulate-complete to credit wallet in sandbox',
    };
  }

  async simulateFundComplete(userId: string, transactionId: string) {
    const txn = await this.db.query.transactions.findFirst({
      where: eq(transactions.id, transactionId),
    });
    if (!txn || txn.userId !== userId) {
      throw new NotFoundException('Funding transaction not found');
    }
    return this.creditFundingTransaction(txn);
  }

  /**
   * Flutterwave webhook / return handler — match by tx_ref (idempotency key).
   */
  async completeFundingByReference(txRef: string, flwRef?: string) {
    const txn = await this.db.query.transactions.findFirst({
      where: eq(transactions.idempotencyKey, `fund:${txRef}`),
    });
    if (!txn) {
      throw new NotFoundException(`No funding txn for tx_ref=${txRef}`);
    }
    if (flwRef) {
      await this.ledger.updateStatus(txn.id, txn.status, {
        externalReference: flwRef,
      });
    }
    return this.creditFundingTransaction(txn);
  }

  async handleFlutterwaveWebhook(
    payload: Record<string, unknown>,
    verifHash?: string,
  ) {
    const expected = this.config.get('FLW_WEBHOOK_HASH', { infer: true });
    if (expected && verifHash !== expected) {
      throw new UnauthorizedException('Invalid Flutterwave webhook signature');
    }

    const event = this.asString(payload.event);
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const status = this.asString(data.status).toLowerCase();
    const txRef = this.asString(data.tx_ref) || this.asString(data.reference);

    if (
      (event === 'charge.completed' || event.includes('charge')) &&
      (status === 'successful' || status === 'success') &&
      txRef
    ) {
      return this.completeFundingByReference(
        txRef,
        this.asString(data.flw_ref) || undefined,
      );
    }

    if (
      (event === 'transfer.completed' || event.includes('transfer')) &&
      txRef
    ) {
      const txn = await this.db.query.transactions.findFirst({
        where: eq(transactions.idempotencyKey, `payout:${txRef}`),
      });
      if (!txn) {
        return { ignored: true, reason: 'payout not found' };
      }
      if (status === 'successful' || status === 'success') {
        await this.ledger.updateStatus(txn.id, 'completed');
        return { ok: true, transactionId: txn.id, status: 'completed' };
      }
      if (status === 'failed') {
        await this.ledger.updateStatus(txn.id, 'failed', {
          failureReason:
            this.asString(data.complete_message) || 'transfer failed',
        });
        return { ok: true, transactionId: txn.id, status: 'failed' };
      }
    }

    return { ignored: true, event, status };
  }

  async payout(userId: string, dto: CreatePayoutDto) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) throw new NotFoundException('User not found');

    const tier = user.kycTier as KycTier;
    const amountMinor = BigInt(dto.amountMajor) * 100n;

    await this.velocity.checkPayout(userId);

    const stepUpThreshold = this.config.get('AUTH_STEPUP_PAYOUT_MINOR', {
      infer: true,
    });
    if (stepUpThreshold > 0 && amountMinor >= BigInt(stepUpThreshold)) {
      await this.auth.assertStepUp(userId);
    }

    const beneficiary = await this.db.query.beneficiaries.findFirst({
      where: and(
        eq(beneficiaries.id, dto.beneficiaryId),
        eq(beneficiaries.userId, userId),
        eq(beneficiaries.isActive, true),
      ),
    });
    if (!beneficiary) {
      throw new NotFoundException('Beneficiary not found');
    }

    const payoutCurrency = beneficiary.currency || MVP_CURRENCY;
    await this.compliance.checkLimits({
      userId,
      tier,
      kind: 'payout',
      amountMinor,
      currency: payoutCurrency,
    });
    const screen = await this.compliance.screenPayout({
      userId,
      amountMinor,
      currency: payoutCurrency,
      country: beneficiary.country,
      beneficiaryName: beneficiary.accountName,
    });
    if (!screen.cleared) {
      throw new ForbiddenException('Payout blocked by compliance screening');
    }

    const userWallet = await this.wallets.ensureUserWallet(
      userId,
      payoutCurrency,
    );
    const clearing = await this.ledger.getSystemWallet(
      SYSTEM_WALLET_KEYS.CLEARING_OUTBOUND,
      payoutCurrency,
    );

    const balance = await this.ledger.getBalance(userWallet.id);
    const feeQuote = this.fees.quote('payout', amountMinor, payoutCurrency);
    const feeMinor = BigInt(feeQuote.feeMinor);
    const totalDebit = amountMinor + feeMinor;
    if (balance < totalDebit) {
      throw new BadRequestException(
        `Insufficient wallet balance (need ${totalDebit.toString()} including fee ${feeMinor.toString()})`,
      );
    }

    const feeWallet = await this.ledger.getSystemWallet(
      SYSTEM_WALLET_KEYS.FEES,
      payoutCurrency,
    );

    const railResult = await this.rail.initiatePayout({
      amountMinor,
      currency: payoutCurrency,
      accountNumber: beneficiary.accountNumber,
      bankCode: beneficiary.bankCode ?? beneficiary.provider,
      accountName: beneficiary.accountName,
      reference: dto.idempotencyKey,
      narration:
        beneficiary.type === 'mobile_money'
          ? `MoMo ${beneficiary.provider ?? ''}`.trim()
          : 'NovaPay payout',
    });

    if (railResult.status === 'failed') {
      throw new BadRequestException(railResult.message ?? 'Payout failed');
    }

    const legs = [
      {
        walletId: userWallet.id,
        direction: 'debit' as const,
        amount: totalDebit,
      },
      {
        walletId: clearing.id,
        direction: 'credit' as const,
        amount: amountMinor,
      },
    ];
    if (feeMinor > 0n) {
      legs.push({
        walletId: feeWallet.id,
        direction: 'credit',
        amount: feeMinor,
      });
    }

    const txn = await this.ledger.post({
      idempotencyKey: `payout:${dto.idempotencyKey}`,
      userId,
      type: 'payout',
      status: railResult.status === 'completed' ? 'completed' : 'processing',
      amount: amountMinor,
      fee: feeMinor,
      currency: payoutCurrency,
      sourceWalletId: userWallet.id,
      destWalletId: clearing.id,
      beneficiaryId: beneficiary.id,
      externalReference: railResult.providerRef,
      metadata: {
        rail: this.rail.name,
        channel: beneficiary.type,
        provider: beneficiary.provider,
        fee: feeQuote,
        beneficiary: {
          accountNumber: beneficiary.accountNumber,
          bankCode: beneficiary.bankCode,
          country: beneficiary.country,
        },
      },
      legs,
    });

    await this.notifications.notify(userId, 'payout.initiated', {
      transactionId: txn.id,
      amountMinor: amountMinor.toString(),
      feeMinor: feeMinor.toString(),
      status: txn.status,
      channel: beneficiary.type,
    });

    return {
      ...this.serializeTxn(txn),
      fee: feeQuote,
      totalDebitMinor: totalDebit.toString(),
      rail: this.rail.name,
      channel: beneficiary.type,
      balanceMinor: (await this.ledger.getBalance(userWallet.id)).toString(),
    };
  }

  async listTransactions(userId: string, page = 1, limit = 50) {
    const where = eq(transactions.userId, userId);
    const offset = paginationOffset(page, limit);
    const [rows, countRows] = await Promise.all([
      this.db.query.transactions.findMany({
        where,
        orderBy: [desc(transactions.createdAt)],
        limit,
        offset,
      }),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(transactions)
        .where(where),
    ]);
    const items = rows.map((t) => this.serializeTxn(t));
    return buildPaginatedResult(items, page, limit, countRows[0]?.count ?? 0);
  }

  async getTransaction(userId: string, id: string) {
    const txn = await this.db.query.transactions.findFirst({
      where: eq(transactions.id, id),
    });
    if (!txn || txn.userId !== userId) {
      throw new NotFoundException('Transaction not found');
    }
    return this.serializeTxn(txn);
  }

  private async creditFundingTransaction(
    txn: typeof transactions.$inferSelect,
  ) {
    if (txn.type !== 'fund') {
      throw new BadRequestException('Not a funding transaction');
    }
    if (txn.status === 'completed') {
      return this.serializeTxn(txn);
    }
    if (txn.status !== 'pending' && txn.status !== 'processing') {
      throw new BadRequestException(
        `Cannot complete funding in status ${txn.status}`,
      );
    }
    if (!txn.userId) {
      throw new BadRequestException('Funding transaction missing user');
    }

    const user = await this.db.query.users.findFirst({
      where: eq(users.id, txn.userId),
    });
    const tier = (user?.kycTier ?? 'tier_0') as KycTier;
    const userWallet = await this.wallets.getUserWalletOrThrow(
      txn.userId,
      txn.currency,
    );
    const current = await this.ledger.getBalance(userWallet.id);
    const feeMinor =
      txn.fee > 0n
        ? txn.fee
        : this.fees.calculateFeeMinor('fund', txn.amount, txn.currency);
    const creditMinor = txn.amount - feeMinor;
    if (creditMinor < 0n) {
      throw new BadRequestException('Funding fee exceeds deposit amount');
    }
    await this.compliance.checkLimits({
      userId: txn.userId,
      tier,
      kind: 'fund',
      amountMinor: txn.amount,
      currency: txn.currency,
      projectedWalletBalance: current + creditMinor,
    });

    const clearing = await this.ledger.getSystemWallet(
      SYSTEM_WALLET_KEYS.CLEARING_INBOUND,
      txn.currency,
    );
    const feeWallet = await this.ledger.getSystemWallet(
      SYSTEM_WALLET_KEYS.FEES,
      txn.currency,
    );

    const legs = [
      {
        walletId: clearing.id,
        direction: 'debit' as const,
        amount: txn.amount,
      },
      {
        walletId: userWallet.id,
        direction: 'credit' as const,
        amount: creditMinor,
      },
    ];
    if (feeMinor > 0n) {
      legs.push({
        walletId: feeWallet.id,
        direction: 'credit',
        amount: feeMinor,
      });
    }

    const completed = await this.ledger.completeWithEntries(txn.id, legs, {
      externalReference: txn.externalReference ?? undefined,
      fee: feeMinor,
      metadata: {
        creditMinor: creditMinor.toString(),
        feeMinor: feeMinor.toString(),
      },
    });

    await this.notifications.notify(txn.userId, 'fund.completed', {
      transactionId: txn.id,
      amountMinor: txn.amount.toString(),
      feeMinor: feeMinor.toString(),
      creditMinor: creditMinor.toString(),
    });

    return {
      ...this.serializeTxn(completed),
      creditMinor: creditMinor.toString(),
      balanceMinor: (await this.ledger.getBalance(userWallet.id)).toString(),
    };
  }

  private serializeTxn(txn: typeof transactions.$inferSelect) {
    return {
      id: txn.id,
      type: txn.type,
      status: txn.status,
      amountMinor: txn.amount.toString(),
      feeMinor: txn.fee.toString(),
      currency: txn.currency,
      externalReference: txn.externalReference,
      beneficiaryId: txn.beneficiaryId,
      failureReason: txn.failureReason,
      createdAt: txn.createdAt,
      updatedAt: txn.updatedAt,
    };
  }

  private asString(value: unknown): string {
    return typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : '';
  }
}
