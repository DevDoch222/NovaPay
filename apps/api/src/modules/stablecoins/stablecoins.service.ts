import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CURRENCY_DECIMALS,
  SYSTEM_WALLET_KEYS,
  USDC_CURRENCY,
  USD_CURRENCY,
  USDT_CURRENCY,
} from '../../common/constants';
import { LedgerService } from '../ledger/ledger.service';
import { WalletsService } from '../ledger/wallets.service';
import { NotificationsService } from '../notifications/notifications.service';
import { buildPaginatedResult } from '../../common/api/pagination.util';

const STABLES = new Set([USDC_CURRENCY, USDT_CURRENCY]);

@Injectable()
export class StablecoinsService {
  constructor(
    private readonly ledger: LedgerService,
    private readonly wallets: WalletsService,
    private readonly notifications: NotificationsService,
  ) {}

  supported() {
    return {
      assets: [USDC_CURRENCY, USDT_CURRENCY],
      note: 'Sandbox custody — 1 USDC/USDT ≈ 1 USD for convert',
    };
  }

  async balances(userId: string, page = 1, limit = 50) {
    const out = [];
    for (const ccy of [USDC_CURRENCY, USDT_CURRENCY]) {
      const wallet = await this.wallets.ensureUserWallet(userId, ccy);
      out.push({
        currency: ccy,
        walletId: wallet.id,
        balanceMinor: (await this.ledger.getBalance(wallet.id)).toString(),
      });
    }
    const offset = (page - 1) * limit;
    const slice = out.slice(offset, offset + limit);
    return buildPaginatedResult(slice, page, limit, out.length);
  }

  /** Sandbox deposit (simulates on-chain receive / custody credit). */
  async deposit(input: {
    userId: string;
    currency: string;
    amountMajor: number;
    idempotencyKey: string;
    txHash?: string;
  }) {
    const currency = input.currency.toUpperCase();
    if (!STABLES.has(currency as 'USDC' | 'USDT')) {
      throw new BadRequestException('Only USDC or USDT supported');
    }
    const amountMinor = BigInt(
      Math.round(input.amountMajor * 10 ** (CURRENCY_DECIMALS[currency] ?? 2)),
    );
    const wallet = await this.wallets.ensureUserWallet(input.userId, currency);
    const clearing = await this.ledger.getSystemWallet(
      SYSTEM_WALLET_KEYS.STABLECOIN_CLEARING,
      currency,
    );

    const txn = await this.ledger.post({
      idempotencyKey: `stable_deposit:${input.idempotencyKey}`,
      userId: input.userId,
      type: 'stablecoin_deposit',
      status: 'completed',
      amount: amountMinor,
      currency,
      sourceWalletId: clearing.id,
      destWalletId: wallet.id,
      externalReference: input.txHash ?? null,
      metadata: { rail: 'mock-custody', txHash: input.txHash ?? null },
      legs: [
        { walletId: clearing.id, direction: 'debit', amount: amountMinor },
        { walletId: wallet.id, direction: 'credit', amount: amountMinor },
      ],
    });

    await this.notifications.notify(input.userId, 'stablecoin.deposit', {
      transactionId: txn.id,
      currency,
    });

    return {
      transactionId: txn.id,
      currency,
      amountMinor: amountMinor.toString(),
      balanceMinor: (await this.ledger.getBalance(wallet.id)).toString(),
    };
  }

  /** Convert stablecoin → USD (1:1 sandbox) or USD → stablecoin. */
  async convert(input: {
    userId: string;
    sourceCurrency: string;
    destCurrency: string;
    sourceAmountMajor: number;
    idempotencyKey: string;
  }) {
    const source = input.sourceCurrency.toUpperCase();
    const dest = input.destCurrency.toUpperCase();
    const pairOk =
      (STABLES.has(source as 'USDC' | 'USDT') && dest === USD_CURRENCY) ||
      (source === USD_CURRENCY && STABLES.has(dest as 'USDC' | 'USDT'));
    if (!pairOk) {
      throw new BadRequestException(
        'Supported pairs: USDC|USDT ↔ USD (1:1 sandbox)',
      );
    }

    const amountMinor = BigInt(
      Math.round(
        input.sourceAmountMajor * 10 ** (CURRENCY_DECIMALS[source] ?? 2),
      ),
    );

    const sourceWallet = await this.wallets.ensureUserWallet(
      input.userId,
      source,
    );
    const destWallet = await this.wallets.ensureUserWallet(input.userId, dest);
    const sourceClearing = await this.ledger.getSystemWallet(
      SYSTEM_WALLET_KEYS.STABLECOIN_CLEARING,
      source,
    );
    const destClearing = await this.ledger.getSystemWallet(
      SYSTEM_WALLET_KEYS.STABLECOIN_CLEARING,
      dest,
    );

    const balance = await this.ledger.getBalance(sourceWallet.id);
    if (balance < amountMinor) {
      throw new BadRequestException('Insufficient balance');
    }

    const txn = await this.ledger.post({
      idempotencyKey: `stable_convert:${input.idempotencyKey}`,
      userId: input.userId,
      type: 'stablecoin_convert',
      status: 'completed',
      amount: amountMinor,
      currency: source,
      sourceWalletId: sourceWallet.id,
      destWalletId: destWallet.id,
      metadata: {
        destCurrency: dest,
        destAmount: amountMinor.toString(),
        rate: '1',
      },
      legs: [
        {
          walletId: sourceWallet.id,
          direction: 'debit',
          amount: amountMinor,
        },
        {
          walletId: sourceClearing.id,
          direction: 'credit',
          amount: amountMinor,
        },
        {
          walletId: destClearing.id,
          direction: 'debit',
          amount: amountMinor,
        },
        {
          walletId: destWallet.id,
          direction: 'credit',
          amount: amountMinor,
        },
      ],
    });

    return {
      transactionId: txn.id,
      sourceCurrency: source,
      destCurrency: dest,
      amountMinor: amountMinor.toString(),
      sourceBalanceMinor: (
        await this.ledger.getBalance(sourceWallet.id)
      ).toString(),
      destBalanceMinor: (
        await this.ledger.getBalance(destWallet.id)
      ).toString(),
    };
  }
}
