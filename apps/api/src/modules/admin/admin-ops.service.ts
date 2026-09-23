import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import {
  auditLogs,
  kycRecords,
  ledgerEntries,
  supportTicketMessages,
  supportTickets,
  transactions,
  users,
  wallets,
} from '../../database/schema';
import { LedgerService } from '../ledger/ledger.service';
import {
  buildPaginatedResult,
  paginationOffset,
} from '../../common/api/pagination.util';
import type { KycTier } from '../../common/constants';

@Injectable()
export class AdminOpsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly ledger: LedgerService,
  ) {}

  async searchUsers(q: string | undefined, page = 1, limit = 50) {
    const offset = paginationOffset(page, limit);
    const where = q?.trim()
      ? or(
          ilike(users.phone, `%${q.trim()}%`),
          ilike(users.tag, `%${q.trim()}%`),
          ilike(users.email, `%${q.trim()}%`),
          sql`${users.id}::text = ${q.trim()}`,
        )
      : undefined;

    const [items, countRows] = await Promise.all([
      this.db.query.users.findMany({
        where,
        orderBy: [desc(users.createdAt)],
        limit,
        offset,
      }),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(where),
    ]);

    return buildPaginatedResult(
      items.map((u) => this.serializeUser(u)),
      page,
      limit,
      countRows[0]?.count ?? 0,
    );
  }

  async getUser(userId: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) throw new NotFoundException('User not found');

    const userWallets = await this.db.query.wallets.findMany({
      where: and(eq(wallets.userId, userId), eq(wallets.ownerType, 'user')),
    });

    const balances = await Promise.all(
      userWallets.map(async (w) => ({
        id: w.id,
        currency: w.currency,
        status: w.status,
        balanceMinor: (await this.ledger.getBalance(w.id)).toString(),
      })),
    );

    const recentTxns = await this.db.query.transactions.findMany({
      where: eq(transactions.userId, userId),
      orderBy: [desc(transactions.createdAt)],
      limit: 20,
    });

    const kycHistory = await this.db
      .select()
      .from(kycRecords)
      .where(eq(kycRecords.userId, userId))
      .orderBy(desc(kycRecords.createdAt))
      .limit(10);

    return {
      user: this.serializeUser(user),
      wallets: balances,
      recentTransactions: recentTxns.map((t) => this.serializeTxn(t)),
      kycRecords: kycHistory.map((r) => this.serializeKyc(r)),
    };
  }

  async listKyc(input: {
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 50;
    const offset = paginationOffset(page, limit);
    const status = input.status?.trim();
    const where =
      status && ['pending', 'approved', 'rejected'].includes(status)
        ? eq(
            kycRecords.verificationStatus,
            status as 'pending' | 'approved' | 'rejected',
          )
        : undefined;

    const [rows, countRows] = await Promise.all([
      this.db
        .select({
          record: kycRecords,
          phone: users.phone,
          tag: users.tag,
          userStatus: users.status,
          kycTier: users.kycTier,
        })
        .from(kycRecords)
        .innerJoin(users, eq(kycRecords.userId, users.id))
        .where(where)
        .orderBy(desc(kycRecords.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(kycRecords)
        .where(where),
    ]);

    return buildPaginatedResult(
      rows.map((r) => ({
        ...this.serializeKyc(r.record),
        user: {
          id: r.record.userId,
          phone: r.phone,
          tag: r.tag,
          status: r.userStatus,
          kycTier: r.kycTier,
        },
      })),
      page,
      limit,
      countRows[0]?.count ?? 0,
    );
  }

  async reviewKyc(input: {
    recordId: string;
    decision: 'approve' | 'reject';
    kycTier?: KycTier;
    reason?: string;
    actorUserId: string;
  }) {
    const record = await this.db.query.kycRecords.findFirst({
      where: eq(kycRecords.id, input.recordId),
    });
    if (!record) throw new NotFoundException('KYC record not found');
    if (record.verificationStatus !== 'pending') {
      throw new BadRequestException(
        `KYC is already ${record.verificationStatus}`,
      );
    }

    const user = await this.db.query.users.findFirst({
      where: eq(users.id, record.userId),
    });
    if (!user) throw new NotFoundException('User not found');

    if (input.decision === 'approve') {
      const tier = input.kycTier ?? 'tier_1';
      if (tier !== 'tier_1' && tier !== 'tier_2') {
        throw new BadRequestException('Approve with tier_1 or tier_2 only');
      }

      const [updated] = await this.db
        .update(kycRecords)
        .set({
          verificationStatus: 'approved',
          metadata: {
            ...(record.metadata ?? {}),
            reviewedBy: input.actorUserId,
            reviewedAt: new Date().toISOString(),
            reason: input.reason ?? null,
            approvedTier: tier,
          },
          updatedAt: new Date(),
        })
        .where(eq(kycRecords.id, record.id))
        .returning();

      await this.db
        .update(users)
        .set({ kycTier: tier, updatedAt: new Date() })
        .where(eq(users.id, user.id));

      await this.writeAudit({
        actor: input.actorUserId,
        action: 'kyc.approve',
        resourceType: 'kyc_record',
        resourceId: record.id,
        reason: input.reason,
        metadata: { userId: user.id, kycTier: tier },
      });

      return {
        record: this.serializeKyc(updated),
        user: this.serializeUser({ ...user, kycTier: tier }),
      };
    }

    const [updated] = await this.db
      .update(kycRecords)
      .set({
        verificationStatus: 'rejected',
        metadata: {
          ...(record.metadata ?? {}),
          reviewedBy: input.actorUserId,
          reviewedAt: new Date().toISOString(),
          reason: input.reason ?? null,
        },
        updatedAt: new Date(),
      })
      .where(eq(kycRecords.id, record.id))
      .returning();

    await this.writeAudit({
      actor: input.actorUserId,
      action: 'kyc.reject',
      resourceType: 'kyc_record',
      resourceId: record.id,
      reason: input.reason,
      metadata: { userId: user.id },
    });

    return {
      record: this.serializeKyc(updated),
      user: this.serializeUser(user),
    };
  }

  private async writeAudit(input: {
    actor: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }) {
    await this.db.insert(auditLogs).values({
      actor: input.actor,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      reason: input.reason,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    });
  }

  async setUserStatus(
    userId: string,
    status: 'active' | 'suspended' | 'closed',
  ) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.platformRole === 'admin' && status !== 'active') {
      throw new BadRequestException('Cannot suspend/close another admin');
    }

    const [updated] = await this.db
      .update(users)
      .set({ status, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return this.serializeUser(updated);
  }

  async setPlatformRole(
    userId: string,
    platformRole: 'customer' | 'support' | 'admin',
  ) {
    const [updated] = await this.db
      .update(users)
      .set({ platformRole, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    if (!updated) throw new NotFoundException('User not found');
    return this.serializeUser(updated);
  }

  async searchTransactions(input: {
    q?: string;
    userId?: string;
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 50;
    const offset = paginationOffset(page, limit);

    const filters = [];
    if (input.userId) filters.push(eq(transactions.userId, input.userId));
    if (input.status) {
      filters.push(
        eq(
          transactions.status,
          input.status as
            | 'pending'
            | 'processing'
            | 'completed'
            | 'failed'
            | 'reversed',
        ),
      );
    }
    if (input.type) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filters.push(eq(transactions.type, input.type as any));
    }
    if (input.q?.trim()) {
      const q = input.q.trim();
      filters.push(
        or(
          sql`${transactions.id}::text = ${q}`,
          ilike(transactions.externalReference, `%${q}%`),
          ilike(transactions.idempotencyKey, `%${q}%`),
        )!,
      );
    }

    const where = filters.length ? and(...filters) : undefined;

    const [items, countRows] = await Promise.all([
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

    return buildPaginatedResult(
      items.map((t) => this.serializeTxn(t)),
      page,
      limit,
      countRows[0]?.count ?? 0,
    );
  }

  async getTransaction(id: string) {
    const txn = await this.db.query.transactions.findFirst({
      where: eq(transactions.id, id),
    });
    if (!txn) throw new NotFoundException('Transaction not found');

    const entries = await this.db.query.ledgerEntries.findMany({
      where: eq(ledgerEntries.transactionId, id),
      orderBy: [desc(ledgerEntries.createdAt)],
    });

    return {
      transaction: this.serializeTxn(txn),
      ledgerEntries: entries.map((e) => ({
        id: e.id,
        walletId: e.walletId,
        direction: e.direction,
        amountMinor: e.amount.toString(),
        balanceAfterMinor: e.balanceAfter.toString(),
        createdAt: e.createdAt,
      })),
    };
  }

  async createTicket(input: {
    userId: string;
    subject: string;
    body: string;
    category?: string;
    priority?: string;
    relatedTransactionId?: string;
    isStaff: boolean;
    authorUserId: string;
  }) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, input.userId),
    });
    if (!user) throw new NotFoundException('User not found');

    const [ticket] = await this.db
      .insert(supportTickets)
      .values({
        userId: input.userId,
        subject: input.subject,
        category: input.category ?? 'general',
        priority: input.priority ?? 'normal',
        relatedTransactionId: input.relatedTransactionId ?? null,
        status: 'open',
      })
      .returning();

    await this.db.insert(supportTicketMessages).values({
      ticketId: ticket.id,
      authorUserId: input.authorUserId,
      body: input.body,
      isStaff: input.isStaff,
    });

    return this.getTicket(ticket.id);
  }

  async listTickets(input: {
    status?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 50;
    const offset = paginationOffset(page, limit);
    const filters = [];
    if (input.userId) filters.push(eq(supportTickets.userId, input.userId));
    if (input.status) {
      filters.push(
        eq(
          supportTickets.status,
          input.status as
            | 'open'
            | 'in_progress'
            | 'waiting_customer'
            | 'resolved'
            | 'closed',
        ),
      );
    }
    const where = filters.length ? and(...filters) : undefined;

    const [items, countRows] = await Promise.all([
      this.db.query.supportTickets.findMany({
        where,
        orderBy: [desc(supportTickets.updatedAt)],
        limit,
        offset,
      }),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(supportTickets)
        .where(where),
    ]);

    return buildPaginatedResult(
      items.map((t) => this.serializeTicket(t)),
      page,
      limit,
      countRows[0]?.count ?? 0,
    );
  }

  async getTicket(id: string) {
    const ticket = await this.db.query.supportTickets.findFirst({
      where: eq(supportTickets.id, id),
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const messages = await this.db.query.supportTicketMessages.findMany({
      where: eq(supportTicketMessages.ticketId, id),
      orderBy: [asc(supportTicketMessages.createdAt)],
    });

    const customer = await this.db.query.users.findFirst({
      where: eq(users.id, ticket.userId),
    });

    return {
      ticket: this.serializeTicket(ticket),
      customer: customer ? this.serializeUser(customer) : null,
      messages: messages.map((m) => ({
        id: m.id,
        body: m.body,
        isStaff: m.isStaff,
        authorUserId: m.authorUserId,
        createdAt: m.createdAt,
      })),
    };
  }

  async replyTicket(input: {
    ticketId: string;
    authorUserId: string;
    body: string;
    isStaff: boolean;
    status?: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
  }) {
    const ticket = await this.db.query.supportTickets.findFirst({
      where: eq(supportTickets.id, input.ticketId),
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    await this.db.insert(supportTicketMessages).values({
      ticketId: input.ticketId,
      authorUserId: input.authorUserId,
      body: input.body,
      isStaff: input.isStaff,
    });

    const wasClosed =
      ticket.status === 'resolved' || ticket.status === 'closed';
    let nextStatus =
      input.status ??
      (input.isStaff ? 'waiting_customer' : ('in_progress' as const));
    // Customer message on a closed ticket reopens it for the support queue
    if (!input.isStaff && wasClosed) {
      nextStatus = 'open';
    }

    await this.db
      .update(supportTickets)
      .set({
        status: nextStatus,
        assignedToUserId: input.isStaff
          ? input.authorUserId
          : ticket.assignedToUserId,
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, input.ticketId));

    return this.getTicket(input.ticketId);
  }

  async reopenTicket(input: {
    ticketId: string;
    userId: string;
    note?: string;
  }) {
    const ticket = await this.db.query.supportTickets.findFirst({
      where: eq(supportTickets.id, input.ticketId),
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== input.userId) {
      throw new ForbiddenException();
    }
    if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
      return this.getTicket(input.ticketId);
    }

    if (input.note?.trim()) {
      await this.db.insert(supportTicketMessages).values({
        ticketId: input.ticketId,
        authorUserId: input.userId,
        body: input.note.trim(),
        isStaff: false,
      });
    } else {
      await this.db.insert(supportTicketMessages).values({
        ticketId: input.ticketId,
        authorUserId: input.userId,
        body: 'Customer reopened this request.',
        isStaff: false,
      });
    }

    await this.db
      .update(supportTickets)
      .set({ status: 'open', updatedAt: new Date() })
      .where(eq(supportTickets.id, input.ticketId));

    return this.getTicket(input.ticketId);
  }

  async updateTicketStatus(
    ticketId: string,
    status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed',
    assignedToUserId?: string,
  ) {
    const [row] = await this.db
      .update(supportTickets)
      .set({
        status,
        ...(assignedToUserId ? { assignedToUserId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, ticketId))
      .returning();
    if (!row) throw new NotFoundException('Ticket not found');
    return this.getTicket(ticketId);
  }

  private serializeUser(user: typeof users.$inferSelect) {
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      tag: user.tag,
      status: user.status,
      kycTier: user.kycTier,
      platformRole: user.platformRole,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private serializeTxn(txn: typeof transactions.$inferSelect) {
    return {
      id: txn.id,
      userId: txn.userId,
      type: txn.type,
      status: txn.status,
      amountMinor: txn.amount.toString(),
      feeMinor: txn.fee.toString(),
      currency: txn.currency,
      externalReference: txn.externalReference,
      idempotencyKey: txn.idempotencyKey,
      metadata: txn.metadata ?? {},
      createdAt: txn.createdAt,
      updatedAt: txn.updatedAt,
    };
  }

  private serializeKyc(r: typeof kycRecords.$inferSelect) {
    return {
      id: r.id,
      userId: r.userId,
      documentType: r.documentType,
      documentNumber: r.documentNumber,
      verificationStatus: r.verificationStatus,
      providerRef: r.providerRef,
      metadata: r.metadata ?? {},
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private serializeTicket(t: typeof supportTickets.$inferSelect) {
    return {
      id: t.id,
      userId: t.userId,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      category: t.category,
      assignedToUserId: t.assignedToUserId,
      relatedTransactionId: t.relatedTransactionId,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }
}
