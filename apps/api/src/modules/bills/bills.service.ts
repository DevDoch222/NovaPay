import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE, type Database } from '../../database/database.module';
import {
  AIRTIME_OPERATORS,
  BILL_CATALOG,
  CURRENCY_DECIMALS,
  MVP_CURRENCY,
  SYSTEM_WALLET_KEYS,
} from '../../common/constants';
import { LedgerService } from '../ledger/ledger.service';
import { WalletsService } from '../ledger/wallets.service';
import { NotificationsService } from '../notifications/notifications.service';
import { randomUUID } from 'crypto';

@Injectable()
export class BillsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly ledger: LedgerService,
    private readonly wallets: WalletsService,
    private readonly notifications: NotificationsService,
  ) {
    void this.db;
  }

  listBillers(country?: string) {
    const rows = BILL_CATALOG.filter((b) =>
      country ? b.country === country.toUpperCase() : true,
    );
    return rows;
  }

  listAirtimeOperators(country?: string) {
    return AIRTIME_OPERATORS.filter((o) =>
      country ? o.country === country.toUpperCase() : true,
    );
  }

  async payBill(input: {
    userId: string;
    billerId: string;
    customerRef: string;
    amountMajor: number;
    idempotencyKey: string;
  }) {
    const biller = BILL_CATALOG.find((b) => b.id === input.billerId);
    if (!biller) throw new NotFoundException('Biller not found');

    const currency = biller.currency;
    const amountMinor = BigInt(
      Math.round(input.amountMajor * 10 ** (CURRENCY_DECIMALS[currency] ?? 2)),
    );

    const wallet = await this.wallets.ensureUserWallet(input.userId, currency);
    const balance = await this.ledger.getBalance(wallet.id);
    if (balance < amountMinor) {
      throw new BadRequestException(`Insufficient ${currency} balance`);
    }

    const clearing = await this.ledger.getSystemWallet(
      SYSTEM_WALLET_KEYS.BILLS,
      currency,
    );

    const providerRef = `bill_${randomUUID()}`;
    const txn = await this.ledger.post({
      idempotencyKey: `bill:${input.idempotencyKey}`,
      userId: input.userId,
      type: 'bill',
      status: 'completed',
      amount: amountMinor,
      currency,
      sourceWalletId: wallet.id,
      destWalletId: clearing.id,
      externalReference: providerRef,
      metadata: {
        billerId: biller.id,
        billerName: biller.name,
        customerRef: input.customerRef,
        category: biller.category,
        rail: 'mock-biller',
      },
      legs: [
        { walletId: wallet.id, direction: 'debit', amount: amountMinor },
        { walletId: clearing.id, direction: 'credit', amount: amountMinor },
      ],
    });

    await this.notifications.notify(input.userId, 'bill.paid', {
      transactionId: txn.id,
      billerId: biller.id,
    });

    return {
      id: txn.id,
      status: txn.status,
      amountMinor: amountMinor.toString(),
      currency,
      biller: { id: biller.id, name: biller.name },
      customerRef: input.customerRef,
      providerRef,
      balanceMinor: (await this.ledger.getBalance(wallet.id)).toString(),
    };
  }

  async topupAirtime(input: {
    userId: string;
    operatorId: string;
    phone: string;
    amountMajor: number;
    idempotencyKey: string;
  }) {
    const operator = AIRTIME_OPERATORS.find((o) => o.id === input.operatorId);
    if (!operator) throw new NotFoundException('Operator not found');

    const currency = operator.currency as string;
    // Airtime catalogs may use KES while Phase 3 wallets default NGN/USD/EUR —
    // charge NGN when catalog currency has no user wallet yet.
    const payCurrency =
      currency === MVP_CURRENCY || currency === 'USD' || currency === 'EUR'
        ? currency
        : MVP_CURRENCY;

    const amountMinor = BigInt(
      Math.round(
        input.amountMajor * 10 ** (CURRENCY_DECIMALS[payCurrency] ?? 2),
      ),
    );

    const wallet = await this.wallets.ensureUserWallet(
      input.userId,
      payCurrency,
    );
    const balance = await this.ledger.getBalance(wallet.id);
    if (balance < amountMinor) {
      throw new BadRequestException(`Insufficient ${payCurrency} balance`);
    }

    const clearing = await this.ledger.getSystemWallet(
      SYSTEM_WALLET_KEYS.BILLS,
      payCurrency,
    );
    const providerRef = `airtime_${randomUUID()}`;

    const txn = await this.ledger.post({
      idempotencyKey: `airtime:${input.idempotencyKey}`,
      userId: input.userId,
      type: 'airtime',
      status: 'completed',
      amount: amountMinor,
      currency: payCurrency,
      sourceWalletId: wallet.id,
      destWalletId: clearing.id,
      externalReference: providerRef,
      metadata: {
        operatorId: operator.id,
        operatorName: operator.name,
        phone: input.phone,
        catalogCurrency: currency,
        rail: 'mock-airtime',
      },
      legs: [
        { walletId: wallet.id, direction: 'debit', amount: amountMinor },
        { walletId: clearing.id, direction: 'credit', amount: amountMinor },
      ],
    });

    await this.notifications.notify(input.userId, 'airtime.topup', {
      transactionId: txn.id,
      phone: input.phone,
    });

    return {
      id: txn.id,
      status: txn.status,
      amountMinor: amountMinor.toString(),
      currency: payCurrency,
      operator: { id: operator.id, name: operator.name },
      phone: input.phone,
      providerRef,
      balanceMinor: (await this.ledger.getBalance(wallet.id)).toString(),
    };
  }
}
