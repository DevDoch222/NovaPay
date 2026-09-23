import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { users } from '../../database/schema';
import type { Env } from '../../config/env.validation';
import { WalletsService } from '../ledger/wallets.service';
import {
  EUR_CURRENCY,
  MVP_CURRENCY,
  USD_CURRENCY,
} from '../../common/constants';

/**
 * Ensures phones listed in ADMIN_SEED_PHONES exist with platformRole=admin.
 * Sandbox convenience — operators still authenticate via OTP.
 */
@Injectable()
export class AdminSeedService implements OnModuleInit {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly config: ConfigService<Env, true>,
    private readonly wallets: WalletsService,
  ) {}

  async onModuleInit() {
    const raw = this.config.get('ADMIN_SEED_PHONES', { infer: true }) ?? '';
    const phones = raw
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (phones.length === 0) return;

    for (const phone of phones) {
      await this.ensureAdmin(phone);
    }
  }

  private async ensureAdmin(phone: string) {
    let user = await this.db.query.users.findFirst({
      where: eq(users.phone, phone),
    });

    if (!user) {
      const [created] = await this.db
        .insert(users)
        .values({
          phone,
          tag: `admin${phone.replace(/\D/g, '').slice(-4)}`,
          status: 'active',
          kycTier: 'tier_2',
          platformRole: 'admin',
        })
        .returning();
      user = created;
      await this.wallets.ensureUserWallet(user.id, MVP_CURRENCY);
      await this.wallets.ensureUserWallet(user.id, USD_CURRENCY);
      await this.wallets.ensureUserWallet(user.id, EUR_CURRENCY);
      this.logger.log(`Seeded platform admin user phone=${phone}`);
      return;
    }

    if (user.platformRole !== 'admin') {
      await this.db
        .update(users)
        .set({ platformRole: 'admin', status: 'active', updatedAt: new Date() })
        .where(eq(users.id, user.id));
      this.logger.log(`Elevated existing user to admin phone=${phone}`);
    }
  }
}
