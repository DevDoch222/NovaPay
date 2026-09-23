import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CURRENCY_DECIMALS } from '../../common/constants';
import type { Env } from '../../config/env.validation';
import type { FeeQuote, FeeRule, FeeTransactionType } from './fees.types';

@Injectable()
export class FeesService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  getRule(type: FeeTransactionType, currency: string): FeeRule {
    const ccy = currency.toUpperCase();
    const conf = this.ruleConfig(type);
    return {
      type,
      currency: ccy,
      bps: conf.bps,
      flatMinor: BigInt(conf.flatMinor),
      minFeeMinor: BigInt(conf.minFeeMinor),
      maxFeeMinor: conf.maxFeeMinor === null ? null : BigInt(conf.maxFeeMinor),
    };
  }

  calculateFeeMinor(
    type: FeeTransactionType,
    amountMinor: bigint,
    currency: string,
  ): bigint {
    if (amountMinor < 0n) {
      throw new BadRequestException('Amount must be non-negative');
    }
    const rule = this.getRule(type, currency);
    const variable = (amountMinor * BigInt(rule.bps)) / 10_000n;
    let fee = variable + rule.flatMinor;
    if (fee < rule.minFeeMinor) fee = rule.minFeeMinor;
    if (rule.maxFeeMinor !== null && fee > rule.maxFeeMinor) {
      fee = rule.maxFeeMinor;
    }
    if (type === 'fund' && fee >= amountMinor && amountMinor > 0n) {
      throw new BadRequestException(
        'Funding fee would consume the full amount — increase amount',
      );
    }
    return fee;
  }

  quote(
    type: FeeTransactionType,
    amountMinor: bigint,
    currency: string,
  ): FeeQuote {
    const rule = this.getRule(type, currency);
    const feeMinor = this.calculateFeeMinor(type, amountMinor, currency);
    const net =
      type === 'fund' ? amountMinor - feeMinor : amountMinor + feeMinor;
    const disclosure =
      type === 'fund'
        ? `Fee ${this.formatMoney(feeMinor, currency)} deducted from deposit. Wallet credit ${this.formatMoney(net, currency)}.`
        : type === 'payout'
          ? `Fee ${this.formatMoney(feeMinor, currency)}. Total debit ${this.formatMoney(net, currency)}.`
          : `Fee ${this.formatMoney(feeMinor, currency)}.`;

    return {
      type,
      currency: currency.toUpperCase(),
      amountMinor: amountMinor.toString(),
      feeMinor: feeMinor.toString(),
      netMinor: net.toString(),
      bps: rule.bps,
      flatMinor: rule.flatMinor.toString(),
      disclosure,
    };
  }

  quoteFromMajor(
    type: FeeTransactionType,
    amountMajor: number,
    currency: string,
  ): FeeQuote {
    if (!Number.isFinite(amountMajor) || amountMajor < 0) {
      throw new BadRequestException(
        'amountMajor must be a non-negative number',
      );
    }
    const decimals = CURRENCY_DECIMALS[currency.toUpperCase()] ?? 2;
    const amountMinor = BigInt(Math.round(amountMajor * 10 ** decimals));
    return this.quote(type, amountMinor, currency);
  }

  private ruleConfig(type: FeeTransactionType): {
    bps: number;
    flatMinor: number;
    minFeeMinor: number;
    maxFeeMinor: number | null;
  } {
    const minFeeMinor = this.config.get('FEE_MIN_MINOR', { infer: true });
    const maxRaw = this.config.get('FEE_MAX_MINOR', { infer: true });
    const maxFeeMinor = maxRaw > 0 ? maxRaw : null;

    switch (type) {
      case 'fund':
        return {
          bps: this.config.get('FEE_FUND_BPS', { infer: true }),
          flatMinor: this.config.get('FEE_FUND_FLAT_MINOR', { infer: true }),
          minFeeMinor,
          maxFeeMinor,
        };
      case 'payout':
        return {
          bps: this.config.get('FEE_PAYOUT_BPS', { infer: true }),
          flatMinor: this.config.get('FEE_PAYOUT_FLAT_MINOR', { infer: true }),
          minFeeMinor,
          maxFeeMinor,
        };
      case 'card_spend':
        return {
          bps: this.config.get('FEE_CARD_SPEND_BPS', { infer: true }),
          flatMinor: this.config.get('FEE_CARD_SPEND_FLAT_MINOR', {
            infer: true,
          }),
          minFeeMinor,
          maxFeeMinor,
        };
      case 'card_issue':
        return {
          bps: 0,
          flatMinor: this.config.get('FEE_CARD_ISSUE_FLAT_MINOR', {
            infer: true,
          }),
          minFeeMinor: 0,
          maxFeeMinor,
        };
      case 'bill':
      case 'airtime':
        return {
          bps: this.config.get('FEE_BILL_BPS', { infer: true }),
          flatMinor: this.config.get('FEE_BILL_FLAT_MINOR', { infer: true }),
          minFeeMinor,
          maxFeeMinor,
        };
      default: {
        const _exhaustive: never = type;
        throw new BadRequestException(
          `Unsupported fee type: ${String(_exhaustive)}`,
        );
      }
    }
  }

  private formatMoney(minor: bigint, currency: string): string {
    const decimals = CURRENCY_DECIMALS[currency.toUpperCase()] ?? 2;
    const major = Number(minor) / 10 ** decimals;
    return `${currency.toUpperCase()} ${major.toFixed(decimals)}`;
  }
}
