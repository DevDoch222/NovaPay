import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import {
  bulkPayoutBatches,
  bulkPayoutItems,
  organizationMembers,
  organizations,
  users,
  wallets,
} from '../../database/schema';
import { MVP_CURRENCY, SYSTEM_WALLET_KEYS } from '../../common/constants';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  buildPaginatedResult,
  paginationOffset,
} from '../../common/api/pagination.util';

@Injectable()
export class BusinessService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationsService,
  ) {}

  async createOrganization(
    userId: string,
    input: { name: string; slug: string; approvalLimitMajor?: number },
  ) {
    const slug = input.slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (slug.length < 3) {
      throw new BadRequestException('slug must be at least 3 chars');
    }

    const [org] = await this.db
      .insert(organizations)
      .values({
        name: input.name,
        slug,
        approvalLimitMinor: BigInt((input.approvalLimitMajor ?? 0) * 100),
      })
      .returning();

    await this.db.insert(organizationMembers).values({
      organizationId: org.id,
      userId,
      role: 'owner',
    });

    await this.db.insert(wallets).values({
      ownerType: 'organization',
      organizationId: org.id,
      currency: MVP_CURRENCY,
      status: 'active',
    });

    await this.ledger.ensureSystemWallets(MVP_CURRENCY);

    return this.serializeOrg(org);
  }

  async listOrganizations(userId: string, page = 1, limit = 50) {
    const where = eq(organizationMembers.userId, userId);
    const offset = paginationOffset(page, limit);
    const [memberships, countRows] = await Promise.all([
      this.db.query.organizationMembers.findMany({
        where,
        orderBy: [desc(organizationMembers.createdAt)],
        limit,
        offset,
      }),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(organizationMembers)
        .where(where),
    ]);
    const orgs = [];
    for (const m of memberships) {
      const org = await this.db.query.organizations.findFirst({
        where: eq(organizations.id, m.organizationId),
      });
      if (org) {
        orgs.push({ ...this.serializeOrg(org), role: m.role });
      }
    }
    return buildPaginatedResult(orgs, page, limit, countRows[0]?.count ?? 0);
  }

  async inviteMember(
    actorUserId: string,
    orgId: string,
    input: {
      userId?: string;
      phone?: string;
      tag?: string;
      role: 'admin' | 'approver' | 'member';
    },
  ) {
    await this.requireRole(actorUserId, orgId, ['owner', 'admin']);

    let targetUserId = input.userId;
    if (!targetUserId && input.phone) {
      const u = await this.db.query.users.findFirst({
        where: eq(users.phone, input.phone),
      });
      if (!u) throw new NotFoundException('No NovaPay user with that phone');
      targetUserId = u.id;
    }
    if (!targetUserId && input.tag) {
      const tag = input.tag.replace(/^@/, '').toLowerCase();
      const u = await this.db.query.users.findFirst({
        where: eq(users.tag, tag),
      });
      if (!u) throw new NotFoundException('No NovaPay user with that username');
      targetUserId = u.id;
    }
    if (!targetUserId) {
      throw new BadRequestException('Provide userId, phone, or tag');
    }
    if (targetUserId === actorUserId) {
      throw new BadRequestException('You are already a member');
    }

    const existing = await this.db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, targetUserId),
      ),
    });
    if (existing) {
      throw new BadRequestException('User is already a member');
    }

    const [row] = await this.db
      .insert(organizationMembers)
      .values({
        organizationId: orgId,
        userId: targetUserId,
        role: input.role,
      })
      .returning();
    return row;
  }

  async listMembers(userId: string, orgId: string, page = 1, limit = 50) {
    await this.requireMembership(userId, orgId);
    const where = eq(organizationMembers.organizationId, orgId);
    const offset = paginationOffset(page, limit);
    const [rows, countRows] = await Promise.all([
      this.db.query.organizationMembers.findMany({
        where,
        orderBy: [desc(organizationMembers.createdAt)],
        limit,
        offset,
      }),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(organizationMembers)
        .where(where),
    ]);
    const out = [];
    for (const m of rows) {
      const u = await this.db.query.users.findFirst({
        where: eq(users.id, m.userId),
      });
      out.push({
        id: m.id,
        organizationId: m.organizationId,
        userId: m.userId,
        role: m.role,
        createdAt: m.createdAt,
        tag: u?.tag ?? null,
        phone: u?.phone ?? null,
      });
    }
    return buildPaginatedResult(out, page, limit, countRows[0]?.count ?? 0);
  }

  async getOrgWalletBalance(userId: string, orgId: string) {
    await this.requireMembership(userId, orgId);
    const wallet = await this.db.query.wallets.findFirst({
      where: and(
        eq(wallets.organizationId, orgId),
        eq(wallets.currency, MVP_CURRENCY),
      ),
    });
    if (!wallet) throw new NotFoundException('Org wallet not found');
    return {
      walletId: wallet.id,
      currency: wallet.currency,
      balanceMinor: (await this.ledger.getBalance(wallet.id)).toString(),
    };
  }

  /** Sandbox: credit org wallet (simulates business funding). */
  async fundOrgWallet(
    userId: string,
    orgId: string,
    amountMajor: number,
    idempotencyKey: string,
  ) {
    await this.requireRole(userId, orgId, ['owner', 'admin']);
    const wallet = await this.db.query.wallets.findFirst({
      where: and(
        eq(wallets.organizationId, orgId),
        eq(wallets.currency, MVP_CURRENCY),
      ),
    });
    if (!wallet) throw new NotFoundException('Org wallet not found');
    const amountMinor = BigInt(amountMajor) * 100n;
    const clearing = await this.ledger.getSystemWallet(
      SYSTEM_WALLET_KEYS.CLEARING_INBOUND,
      MVP_CURRENCY,
    );
    const txn = await this.ledger.post({
      idempotencyKey: `org_fund:${idempotencyKey}`,
      userId,
      type: 'fund',
      status: 'completed',
      amount: amountMinor,
      currency: MVP_CURRENCY,
      sourceWalletId: clearing.id,
      destWalletId: wallet.id,
      metadata: { organizationId: orgId },
      legs: [
        { walletId: clearing.id, direction: 'debit', amount: amountMinor },
        { walletId: wallet.id, direction: 'credit', amount: amountMinor },
      ],
    });
    return {
      transactionId: txn.id,
      balanceMinor: (await this.ledger.getBalance(wallet.id)).toString(),
    };
  }

  async createBulkPayout(
    userId: string,
    orgId: string,
    input: {
      idempotencyKey: string;
      items: Array<{
        accountName: string;
        accountNumber: string;
        bankCode?: string;
        amountMajor: number;
      }>;
    },
  ) {
    await this.requireRole(userId, orgId, ['owner', 'admin', 'approver']);
    const existing = await this.db.query.bulkPayoutBatches.findFirst({
      where: eq(bulkPayoutBatches.idempotencyKey, input.idempotencyKey),
    });
    if (existing) return this.getBatch(userId, orgId, existing.id);

    let total = 0n;
    for (const item of input.items) {
      total += BigInt(item.amountMajor) * 100n;
    }

    const org = await this.db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });
    if (!org) throw new NotFoundException('Organization not found');

    const needsApproval = total > org.approvalLimitMinor;
    const [batch] = await this.db
      .insert(bulkPayoutBatches)
      .values({
        organizationId: orgId,
        createdByUserId: userId,
        currency: MVP_CURRENCY,
        status: needsApproval ? 'pending_approval' : 'processing',
        totalAmount: total,
        itemCount: String(input.items.length),
        idempotencyKey: input.idempotencyKey,
      })
      .returning();

    for (const item of input.items) {
      await this.db.insert(bulkPayoutItems).values({
        batchId: batch.id,
        accountName: item.accountName,
        accountNumber: item.accountNumber,
        bankCode: item.bankCode,
        amount: BigInt(item.amountMajor) * 100n,
        status: 'pending',
      });
    }

    if (!needsApproval) {
      await this.executeBatch(batch.id, userId);
    }

    return this.getBatch(userId, orgId, batch.id);
  }

  async approveBulkPayout(userId: string, orgId: string, batchId: string) {
    await this.requireRole(userId, orgId, ['owner', 'admin', 'approver']);
    const batch = await this.db.query.bulkPayoutBatches.findFirst({
      where: and(
        eq(bulkPayoutBatches.id, batchId),
        eq(bulkPayoutBatches.organizationId, orgId),
      ),
    });
    if (!batch) throw new NotFoundException('Batch not found');
    if (batch.status !== 'pending_approval') {
      throw new BadRequestException(`Batch is ${batch.status}`);
    }
    if (batch.createdByUserId === userId) {
      throw new ForbiddenException('Creator cannot approve their own batch');
    }

    await this.db
      .update(bulkPayoutBatches)
      .set({
        status: 'processing',
        approvedByUserId: userId,
        updatedAt: new Date(),
      })
      .where(eq(bulkPayoutBatches.id, batchId));

    await this.executeBatch(batchId, userId);
    return this.getBatch(userId, orgId, batchId);
  }

  async getBatch(userId: string, orgId: string, batchId: string) {
    await this.requireMembership(userId, orgId);
    const batch = await this.db.query.bulkPayoutBatches.findFirst({
      where: and(
        eq(bulkPayoutBatches.id, batchId),
        eq(bulkPayoutBatches.organizationId, orgId),
      ),
    });
    if (!batch) throw new NotFoundException('Batch not found');
    const items = await this.db.query.bulkPayoutItems.findMany({
      where: eq(bulkPayoutItems.batchId, batchId),
    });
    return {
      id: batch.id,
      status: batch.status,
      currency: batch.currency,
      totalAmountMinor: batch.totalAmount.toString(),
      itemCount: batch.itemCount,
      createdByUserId: batch.createdByUserId,
      approvedByUserId: batch.approvedByUserId,
      createdAt: batch.createdAt,
      items: items.map((i) => ({
        id: i.id,
        accountName: i.accountName,
        accountNumber: i.accountNumber,
        bankCode: i.bankCode,
        amountMinor: i.amount.toString(),
        status: i.status,
        transactionId: i.transactionId,
        failureReason: i.failureReason,
      })),
    };
  }

  async listBatches(userId: string, orgId: string, page = 1, limit = 50) {
    await this.requireMembership(userId, orgId);
    const where = eq(bulkPayoutBatches.organizationId, orgId);
    const offset = paginationOffset(page, limit);
    const [batches, countRows] = await Promise.all([
      this.db.query.bulkPayoutBatches.findMany({
        where,
        orderBy: [desc(bulkPayoutBatches.createdAt)],
        limit,
        offset,
      }),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(bulkPayoutBatches)
        .where(where),
    ]);
    const items = batches.map((b) => ({
      id: b.id,
      status: b.status,
      currency: b.currency,
      totalAmountMinor: b.totalAmount.toString(),
      itemCount: b.itemCount,
      createdByUserId: b.createdByUserId,
      createdAt: b.createdAt,
    }));
    return buildPaginatedResult(items, page, limit, countRows[0]?.count ?? 0);
  }

  private async executeBatch(batchId: string, actorUserId: string) {
    const batch = await this.db.query.bulkPayoutBatches.findFirst({
      where: eq(bulkPayoutBatches.id, batchId),
    });
    if (!batch) return;

    const orgWallet = await this.db.query.wallets.findFirst({
      where: and(
        eq(wallets.organizationId, batch.organizationId),
        eq(wallets.currency, batch.currency),
      ),
    });
    if (!orgWallet) throw new NotFoundException('Org wallet missing');

    const clearing = await this.ledger.getSystemWallet(
      SYSTEM_WALLET_KEYS.CLEARING_OUTBOUND,
      batch.currency,
    );
    const items = await this.db.query.bulkPayoutItems.findMany({
      where: eq(bulkPayoutItems.batchId, batchId),
    });

    for (const item of items) {
      try {
        const balance = await this.ledger.getBalance(orgWallet.id);
        if (balance < item.amount) {
          await this.db
            .update(bulkPayoutItems)
            .set({
              status: 'failed',
              failureReason: 'Insufficient org balance',
            })
            .where(eq(bulkPayoutItems.id, item.id));
          continue;
        }
        const txn = await this.ledger.post({
          idempotencyKey: `bulk:${batchId}:${item.id}`,
          userId: actorUserId,
          type: 'bulk_payout',
          status: 'completed',
          amount: item.amount,
          currency: batch.currency,
          sourceWalletId: orgWallet.id,
          destWalletId: clearing.id,
          metadata: {
            batchId,
            organizationId: batch.organizationId,
            accountNumber: item.accountNumber,
            bankCode: item.bankCode,
          },
          legs: [
            { walletId: orgWallet.id, direction: 'debit', amount: item.amount },
            { walletId: clearing.id, direction: 'credit', amount: item.amount },
          ],
        });
        await this.db
          .update(bulkPayoutItems)
          .set({ status: 'completed', transactionId: txn.id })
          .where(eq(bulkPayoutItems.id, item.id));
      } catch (e) {
        await this.db
          .update(bulkPayoutItems)
          .set({
            status: 'failed',
            failureReason: e instanceof Error ? e.message : 'failed',
          })
          .where(eq(bulkPayoutItems.id, item.id));
      }
    }

    await this.db
      .update(bulkPayoutBatches)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(bulkPayoutBatches.id, batchId));

    await this.notifications.notify(actorUserId, 'bulk_payout.completed', {
      batchId,
    });
  }

  private async requireMembership(userId: string, orgId: string) {
    const m = await this.db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, userId),
      ),
    });
    if (!m) throw new ForbiddenException('Not an organization member');
    return m;
  }

  private async requireRole(
    userId: string,
    orgId: string,
    roles: Array<'owner' | 'admin' | 'approver' | 'member'>,
  ) {
    const m = await this.requireMembership(userId, orgId);
    if (!roles.includes(m.role)) {
      throw new ForbiddenException(`Requires role: ${roles.join('|')}`);
    }
    return m;
  }

  private serializeOrg(org: typeof organizations.$inferSelect) {
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      approvalLimitMinor: org.approvalLimitMinor.toString(),
      createdAt: org.createdAt,
    };
  }
}
