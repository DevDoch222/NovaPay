import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { fxQuotes } from '../../database/schema';
import {
  CURRENCY_DECIMALS,
  DEFAULT_USD_EUR_MID,
  DEFAULT_USD_NGN_MID,
  FX_FIAT_CURRENCIES,
  SYSTEM_WALLET_KEYS,
} from '../../common/constants';
import { LedgerService } from '../ledger/ledger.service';
import { WalletsService } from '../ledger/wallets.service';
import type { Env } from '../../config/env.validation';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FxService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly config: ConfigService<Env, true>,
    private readonly ledger: LedgerService,
    private readonly wallets: WalletsService,
    private readonly notifications: NotificationsService,
  ) {}

  async getRate(source: string, dest: string) {
    this.assertPair(source, dest);
    const mid = await this.fetchMidRate(source, dest);
    const marginBps = this.marginBps();
    const client = this.applyMargin(mid, source, dest, marginBps);
    return {
      sourceCurrency: source,
      destCurrency: dest,
      midRate: mid.toFixed(8),
      clientRate: client.toFixed(8),
      marginBps,
      /** Units of source currency per 1 dest, or dest per 1 source — see rateMeaning */
      rateMeaning: `${dest} received per 1 ${source} (client)`,
    };
  }

  async createQuote(input: {
    userId: string;
    sourceCurrency: string;
    destCurrency: string;
    sourceAmountMajor: number;
  }) {
    const { sourceCurrency, destCurrency } = input;
    this.assertPair(sourceCurrency, destCurrency);

    const sourceMinor = this.toMinor(input.sourceAmountMajor, sourceCurrency);
    if (sourceMinor <= 0n) {
      throw new BadRequestException('Amount must be positive');
    }

    const mid = await this.fetchMidRate(sourceCurrency, destCurrency);
    const marginBps = this.marginBps();
    const client = this.applyMargin(
      mid,
      sourceCurrency,
      destCurrency,
      marginBps,
    );
    const destMinor = this.convertMinor(
      sourceMinor,
      client,
      sourceCurrency,
      destCurrency,
    );

    const ttl = Number(
      this.config.get('FX_QUOTE_TTL_SECONDS', { infer: true }) ?? 60,
    );
    const expiresAt = new Date(Date.now() + ttl * 1000);

    const [quote] = await this.db
      .insert(fxQuotes)
      .values({
        userId: input.userId,
        sourceCurrency,
        destCurrency,
        sourceAmount: sourceMinor,
        destAmount: destMinor,
        midRate: mid.toFixed(8),
        clientRate: client.toFixed(8),
        marginBps: String(marginBps),
        status: 'open',
        expiresAt,
      })
      .returning();

    return this.serializeQuote(quote);
  }

  async bookQuote(userId: string, quoteId: string, idempotencyKey: string) {
    const quote = await this.db.query.fxQuotes.findFirst({
      where: and(eq(fxQuotes.id, quoteId), eq(fxQuotes.userId, userId)),
    });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.status === 'booked' && quote.bookedTransactionId) {
      const balSource = await this.wallets.getUserWalletOrThrow(
        userId,
        quote.sourceCurrency,
      );
      const balDest = await this.wallets.getUserWalletOrThrow(
        userId,
        quote.destCurrency,
      );
      return {
        quote: this.serializeQuote(quote),
        transactionId: quote.bookedTransactionId,
        sourceBalanceMinor: (
          await this.ledger.getBalance(balSource.id)
        ).toString(),
        destBalanceMinor: (await this.ledger.getBalance(balDest.id)).toString(),
      };
    }
    if (quote.status !== 'open') {
      throw new BadRequestException(`Quote is ${quote.status}`);
    }
    if (quote.expiresAt.getTime() < Date.now()) {
      await this.db
        .update(fxQuotes)
        .set({ status: 'expired' })
        .where(eq(fxQuotes.id, quote.id));
      throw new BadRequestException('Quote expired — request a new quote');
    }

    const sourceWallet = await this.wallets.ensureUserWallet(
      userId,
      quote.sourceCurrency,
    );
    const destWallet = await this.wallets.ensureUserWallet(
      userId,
      quote.destCurrency,
    );
    const sourceFx = await this.ledger.getSystemWallet(
      SYSTEM_WALLET_KEYS.FX_CLEARING,
      quote.sourceCurrency,
    );
    const destFx = await this.ledger.getSystemWallet(
      SYSTEM_WALLET_KEYS.FX_CLEARING,
      quote.destCurrency,
    );

    const balance = await this.ledger.getBalance(sourceWallet.id);
    if (balance < quote.sourceAmount) {
      throw new BadRequestException('Insufficient source wallet balance');
    }

    const txn = await this.ledger.post({
      idempotencyKey: `fx:${idempotencyKey}`,
      userId,
      type: 'convert',
      status: 'completed',
      amount: quote.sourceAmount,
      currency: quote.sourceCurrency,
      sourceWalletId: sourceWallet.id,
      destWalletId: destWallet.id,
      metadata: {
        quoteId: quote.id,
        destCurrency: quote.destCurrency,
        destAmount: quote.destAmount.toString(),
        midRate: quote.midRate,
        clientRate: quote.clientRate,
        marginBps: quote.marginBps,
      },
      legs: [
        {
          walletId: sourceWallet.id,
          direction: 'debit',
          amount: quote.sourceAmount,
        },
        {
          walletId: sourceFx.id,
          direction: 'credit',
          amount: quote.sourceAmount,
        },
        {
          walletId: destFx.id,
          direction: 'debit',
          amount: quote.destAmount,
        },
        {
          walletId: destWallet.id,
          direction: 'credit',
          amount: quote.destAmount,
        },
      ],
    });

    await this.db
      .update(fxQuotes)
      .set({
        status: 'booked',
        bookedTransactionId: txn.id,
      })
      .where(eq(fxQuotes.id, quote.id));

    await this.notifications.notify(userId, 'fx.converted', {
      quoteId: quote.id,
      transactionId: txn.id,
    });

    return {
      quote: this.serializeQuote({
        ...quote,
        status: 'booked',
        bookedTransactionId: txn.id,
      }),
      transactionId: txn.id,
      sourceBalanceMinor: (
        await this.ledger.getBalance(sourceWallet.id)
      ).toString(),
      destBalanceMinor: (
        await this.ledger.getBalance(destWallet.id)
      ).toString(),
    };
  }

  private marginBps() {
    return Number(this.config.get('FX_MARGIN_BPS', { infer: true }) ?? 150);
  }

  private fetchMidRate(source: string, dest: string): Promise<number> {
    // Mid = dest units per 1 source unit, triangulated through USD
    const usdOf = this.usdPerUnit(source);
    const usdOfDest = this.usdPerUnit(dest);
    if (usdOfDest <= 0) {
      return Promise.reject(new BadRequestException('Unsupported FX pair'));
    }
    return Promise.resolve(usdOf / usdOfDest);
  }

  /** USD value of 1 major unit of currency (sandbox mids). */
  private usdPerUnit(currency: string): number {
    const ngnPerUsd = Number(
      this.config.get('FX_USD_NGN_MID', { infer: true }) ?? DEFAULT_USD_NGN_MID,
    );
    const eurPerUsd = Number(
      this.config.get('FX_USD_EUR_MID', { infer: true }) ?? DEFAULT_USD_EUR_MID,
    );
    switch (currency) {
      case 'USD':
        return 1;
      case 'NGN':
        return 1 / ngnPerUsd;
      case 'EUR':
        return 1 / eurPerUsd;
      default:
        throw new BadRequestException('Unsupported FX currency');
    }
  }

  /** Apply margin against customer (worse than mid). */
  private applyMargin(
    mid: number,
    source: string,
    dest: string,
    marginBps: number,
  ) {
    const factor = marginBps / 10_000;
    // Customer always gets fewer dest units per source than mid
    return mid * (1 - factor);
  }

  private convertMinor(
    sourceMinor: bigint,
    clientRate: number,
    source: string,
    dest: string,
  ): bigint {
    const srcDec = CURRENCY_DECIMALS[source] ?? 2;
    const dstDec = CURRENCY_DECIMALS[dest] ?? 2;
    const sourceMajor = Number(sourceMinor) / 10 ** srcDec;
    const destMajor = sourceMajor * clientRate;
    const destMinor = BigInt(Math.floor(destMajor * 10 ** dstDec + 1e-9));
    if (destMinor <= 0n) {
      throw new BadRequestException('Converted amount too small');
    }
    return destMinor;
  }

  private toMinor(major: number, currency: string): bigint {
    const dec = CURRENCY_DECIMALS[currency] ?? 2;
    return BigInt(Math.round(major * 10 ** dec));
  }

  private assertPair(source: string, dest: string) {
    if (source === dest) {
      throw new BadRequestException('Source and dest currency must differ');
    }
    const fiat = FX_FIAT_CURRENCIES as readonly string[];
    if (!fiat.includes(source) || !fiat.includes(dest)) {
      throw new BadRequestException(
        `FX supports ${FX_FIAT_CURRENCIES.join(', ')}. Use Stablecoins for USDC/USDT.`,
      );
    }
  }

  private serializeQuote(quote: typeof fxQuotes.$inferSelect) {
    return {
      id: quote.id,
      sourceCurrency: quote.sourceCurrency,
      destCurrency: quote.destCurrency,
      sourceAmountMinor: quote.sourceAmount.toString(),
      destAmountMinor: quote.destAmount.toString(),
      midRate: quote.midRate,
      clientRate: quote.clientRate,
      marginBps: quote.marginBps,
      status: quote.status,
      expiresAt: quote.expiresAt,
      bookedTransactionId: quote.bookedTransactionId,
    };
  }
}
