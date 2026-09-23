import {
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { wallets } from '../../database/schema';
import {
  MVP_CURRENCY,
  USD_CURRENCY,
  EUR_CURRENCY,
  USDC_CURRENCY,
  USDT_CURRENCY,
} from '../../common/constants';
import { LedgerService } from './ledger.service';

@Injectable()
export class WalletsService implements OnModuleInit {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly ledger: LedgerService,
  ) {}

  async onModuleInit() {
    await this.ledger.ensureSystemWallets(MVP_CURRENCY);
    await this.ledger.ensureSystemWallets(USD_CURRENCY);
    await this.ledger.ensureSystemWallets(EUR_CURRENCY);
    await this.ledger.ensureSystemWallets(USDC_CURRENCY);
    await this.ledger.ensureSystemWallets(USDT_CURRENCY);
  }

  async ensureUserWallet(userId: string, currency: string = MVP_CURRENCY) {
    const existing = await this.db.query.wallets.findFirst({
      where: and(eq(wallets.userId, userId), eq(wallets.currency, currency)),
    });
    if (existing) return existing;

    const [created] = await this.db
      .insert(wallets)
      .values({
        ownerType: 'user',
        userId,
        currency,
        status: 'active',
      })
      .returning();
    return created;
  }

  async listUserWallets(userId: string) {
    const rows = await this.db.query.wallets.findMany({
      where: and(eq(wallets.userId, userId), eq(wallets.ownerType, 'user')),
    });
    return Promise.all(
      rows.map(async (w) => ({
        id: w.id,
        currency: w.currency,
        status: w.status,
        balanceMinor: (await this.ledger.getBalance(w.id)).toString(),
        createdAt: w.createdAt,
      })),
    );
  }

  async getUserWalletOrThrow(userId: string, currency: string = MVP_CURRENCY) {
    const wallet = await this.db.query.wallets.findFirst({
      where: and(eq(wallets.userId, userId), eq(wallets.currency, currency)),
    });
    if (!wallet) {
      throw new NotFoundException(`${currency} wallet not found`);
    }
    return wallet;
  }
}
