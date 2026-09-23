import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';
import { DRIZZLE, type Database } from '../../database/database.module';
import { apiKeys, transactions, webhookEndpoints } from '../../database/schema';
import { API_SCOPES, type ApiScope } from '../../common/constants';
import { WalletsService } from '../ledger/wallets.service';
import {
  buildPaginatedResult,
  paginationOffset,
} from '../../common/api/pagination.util';

export function hashApiKey(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

export function generateApiKey() {
  const raw = `np_test_${randomBytes(24).toString('hex')}`;
  return { raw, prefix: raw.slice(0, 12), hash: hashApiKey(raw) };
}

@Injectable()
export class PublicApiService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly wallets: WalletsService,
  ) {}

  async createApiKey(
    userId: string,
    input: { name: string; scopes?: string[] },
  ) {
    const scopes = input.scopes?.length
      ? input.scopes
      : ['wallets:read', 'transactions:read'];
    for (const s of scopes) {
      if (!API_SCOPES.includes(s as ApiScope)) {
        throw new BadRequestException(`Invalid scope: ${s}`);
      }
    }
    const { raw, prefix, hash } = generateApiKey();
    const [row] = await this.db
      .insert(apiKeys)
      .values({
        userId,
        name: input.name,
        keyPrefix: prefix,
        keyHash: hash,
        scopes,
      })
      .returning();

    return {
      id: row.id,
      name: row.name,
      keyPrefix: row.keyPrefix,
      scopes: row.scopes,
      /** Shown once — store securely */
      apiKey: raw,
      createdAt: row.createdAt,
    };
  }

  async listApiKeys(userId: string, page = 1, limit = 50) {
    const where = and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt));
    const offset = paginationOffset(page, limit);
    const [rows, countRows] = await Promise.all([
      this.db.query.apiKeys.findMany({
        where,
        orderBy: [desc(apiKeys.createdAt)],
        limit,
        offset,
      }),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(apiKeys)
        .where(where),
    ]);
    const items = rows.map((r) => ({
      id: r.id,
      name: r.name,
      keyPrefix: r.keyPrefix,
      scopes: r.scopes,
      lastUsedAt: r.lastUsedAt,
      createdAt: r.createdAt,
    }));
    return buildPaginatedResult(items, page, limit, countRows[0]?.count ?? 0);
  }

  async revokeApiKey(userId: string, keyId: string) {
    const [row] = await this.db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
      .returning();
    if (!row) throw new NotFoundException('API key not found');
    return { id: row.id, revokedAt: row.revokedAt };
  }

  async resolveApiKey(raw: string) {
    const hash = hashApiKey(raw);
    const key = await this.db.query.apiKeys.findFirst({
      where: and(eq(apiKeys.keyHash, hash), isNull(apiKeys.revokedAt)),
    });
    if (!key || !key.userId) {
      throw new UnauthorizedException('Invalid API key');
    }
    await this.db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, key.id));
    return key;
  }

  async createWebhook(
    userId: string,
    input: { url: string; events: string[] },
  ) {
    const secret = `whsec_${randomBytes(16).toString('hex')}`;
    const [row] = await this.db
      .insert(webhookEndpoints)
      .values({
        userId,
        url: input.url,
        secret,
        events: input.events.length ? input.events : ['*'],
      })
      .returning();
    return {
      id: row.id,
      url: row.url,
      events: row.events,
      secret,
      isActive: row.isActive,
      createdAt: row.createdAt,
    };
  }

  async listWebhooks(userId: string, page = 1, limit = 50) {
    const where = and(
      eq(webhookEndpoints.userId, userId),
      eq(webhookEndpoints.isActive, true),
    );
    const offset = paginationOffset(page, limit);
    const [rows, countRows] = await Promise.all([
      this.db.query.webhookEndpoints.findMany({
        where,
        orderBy: [desc(webhookEndpoints.createdAt)],
        limit,
        offset,
      }),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(webhookEndpoints)
        .where(where),
    ]);
    const items = rows.map((r) => ({
      id: r.id,
      url: r.url,
      events: r.events,
      isActive: r.isActive,
      createdAt: r.createdAt,
    }));
    return buildPaginatedResult(items, page, limit, countRows[0]?.count ?? 0);
  }

  async publicWallets(userId: string) {
    return this.wallets.listUserWallets(userId);
  }

  async publicTransactions(userId: string, page = 1, limit = 50) {
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
    const items = rows.map((t) => ({
      id: t.id,
      type: t.type,
      status: t.status,
      amountMinor: t.amount.toString(),
      currency: t.currency,
      createdAt: t.createdAt,
    }));
    return buildPaginatedResult(items, page, limit, countRows[0]?.count ?? 0);
  }
}
