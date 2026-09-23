import {
  bigint,
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const userStatusEnum = pgEnum('user_status', [
  'pending',
  'active',
  'suspended',
  'closed',
]);

export const walletOwnerTypeEnum = pgEnum('wallet_owner_type', [
  'user',
  'system',
  'organization',
]);

export const walletStatusEnum = pgEnum('wallet_status', [
  'active',
  'frozen',
  'closed',
]);

export const ledgerDirectionEnum = pgEnum('ledger_direction', [
  'debit',
  'credit',
]);

export const transactionTypeEnum = pgEnum('transaction_type', [
  'fund',
  'payout',
  'transfer',
  'convert',
  'card_spend',
  'receive',
  'bill',
  'airtime',
  'stablecoin_deposit',
  'stablecoin_convert',
  'bulk_payout',
  'reversal',
  'adjustment',
]);

export const transactionStatusEnum = pgEnum('transaction_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'reversed',
]);

export const beneficiaryTypeEnum = pgEnum('beneficiary_type', [
  'bank',
  'mobile_money',
]);

export const kycStatusEnum = pgEnum('kyc_status', [
  'pending',
  'approved',
  'rejected',
]);

export const cardStatusEnum = pgEnum('card_status', [
  'active',
  'frozen',
  'closed',
]);

export const fxQuoteStatusEnum = pgEnum('fx_quote_status', [
  'open',
  'booked',
  'expired',
]);

/** Platform staff role — org `admin` is unrelated (business orgs). */
export const platformRoleEnum = pgEnum('platform_role', [
  'customer',
  'support',
  'admin',
]);

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    phone: varchar('phone', { length: 32 }).notNull(),
    email: varchar('email', { length: 255 }),
    tag: varchar('tag', { length: 64 }),
    /** Profile photo — https URL or data URL (sandbox-friendly). */
    avatarUrl: text('avatar_url'),
    status: userStatusEnum('status').notNull().default('pending'),
    kycTier: varchar('kyc_tier', { length: 32 }).notNull().default('tier_0'),
    platformRole: platformRoleEnum('platform_role')
      .notNull()
      .default('customer'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('users_phone_uidx').on(t.phone),
    uniqueIndex('users_tag_uidx').on(t.tag),
    index('users_platform_role_idx').on(t.platformRole),
  ],
);

export const wallets = pgTable(
  'wallets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerType: walletOwnerTypeEnum('owner_type').notNull(),
    userId: uuid('user_id').references(() => users.id),
    systemKey: varchar('system_key', { length: 64 }),
    currency: varchar('currency', { length: 8 }).notNull(),
    status: walletStatusEnum('status').notNull().default('active'),
    organizationId: uuid('organization_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('wallets_user_currency_uidx').on(t.userId, t.currency),
    uniqueIndex('wallets_system_key_currency_uidx').on(t.systemKey, t.currency),
    uniqueIndex('wallets_org_currency_uidx').on(t.organizationId, t.currency),
    index('wallets_user_id_idx').on(t.userId),
  ],
);

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id),
    type: transactionTypeEnum('type').notNull(),
    status: transactionStatusEnum('status').notNull().default('pending'),
    amount: bigint('amount', { mode: 'bigint' }).notNull(),
    fee: bigint('fee', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    currency: varchar('currency', { length: 3 }).notNull(),
    sourceWalletId: uuid('source_wallet_id').references(() => wallets.id),
    destWalletId: uuid('dest_wallet_id').references(() => wallets.id),
    beneficiaryId: uuid('beneficiary_id'),
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
    externalReference: varchar('external_reference', { length: 128 }),
    failureReason: text('failure_reason'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('transactions_idempotency_key_uidx').on(t.idempotencyKey),
    index('transactions_user_id_idx').on(t.userId),
    index('transactions_status_idx').on(t.status),
  ],
);

export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    walletId: uuid('wallet_id')
      .notNull()
      .references(() => wallets.id),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id),
    direction: ledgerDirectionEnum('direction').notNull(),
    amount: bigint('amount', { mode: 'bigint' }).notNull(),
    balanceAfter: bigint('balance_after', { mode: 'bigint' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('ledger_entries_wallet_id_idx').on(t.walletId),
    index('ledger_entries_transaction_id_idx').on(t.transactionId),
  ],
);

export const beneficiaries = pgTable(
  'beneficiaries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    type: beneficiaryTypeEnum('type').notNull(),
    country: varchar('country', { length: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('NGN'),
    label: varchar('label', { length: 128 }),
    accountName: varchar('account_name', { length: 255 }).notNull(),
    accountNumber: varchar('account_number', { length: 64 }).notNull(),
    bankCode: varchar('bank_code', { length: 32 }),
    bankName: varchar('bank_name', { length: 128 }),
    /** MoMo network: mtn | airtel | mpesa | vodafone */
    provider: varchar('provider', { length: 32 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('beneficiaries_user_id_idx').on(t.userId)],
);

export const kycRecords = pgTable(
  'kyc_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    documentType: varchar('document_type', { length: 64 }).notNull(),
    documentNumber: varchar('document_number', { length: 128 }),
    verificationStatus: kycStatusEnum('verification_status')
      .notNull()
      .default('pending'),
    providerRef: varchar('provider_ref', { length: 128 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('kyc_records_user_id_idx').on(t.userId)],
);

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  reason: text('reason'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const fxQuotes = pgTable(
  'fx_quotes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    sourceCurrency: varchar('source_currency', { length: 3 }).notNull(),
    destCurrency: varchar('dest_currency', { length: 3 }).notNull(),
    sourceAmount: bigint('source_amount', { mode: 'bigint' }).notNull(),
    destAmount: bigint('dest_amount', { mode: 'bigint' }).notNull(),
    midRate: varchar('mid_rate', { length: 64 }).notNull(),
    clientRate: varchar('client_rate', { length: 64 }).notNull(),
    marginBps: varchar('margin_bps', { length: 16 }).notNull(),
    status: fxQuoteStatusEnum('status').notNull().default('open'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    bookedTransactionId: uuid('booked_transaction_id').references(
      () => transactions.id,
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('fx_quotes_user_id_idx').on(t.userId)],
);

export const cardFormEnum = pgEnum('card_form', ['virtual', 'physical']);

export const cards = pgTable(
  'cards',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    walletId: uuid('wallet_id')
      .notNull()
      .references(() => wallets.id),
    processorRef: varchar('processor_ref', { length: 128 }).notNull(),
    brand: varchar('brand', { length: 32 }).notNull().default('visa'),
    last4: varchar('last4', { length: 4 }).notNull(),
    expMonth: varchar('exp_month', { length: 2 }).notNull(),
    expYear: varchar('exp_year', { length: 4 }).notNull(),
    status: cardStatusEnum('status').notNull().default('active'),
    form: cardFormEnum('form').notNull().default('virtual'),
    currency: varchar('currency', { length: 8 }).notNull().default('USD'),
    spendLimitMinor: bigint('spend_limit_minor', { mode: 'bigint' }),
    label: varchar('label', { length: 128 }),
    shippingName: varchar('shipping_name', { length: 255 }),
    shippingLine1: varchar('shipping_line1', { length: 255 }),
    shippingCity: varchar('shipping_city', { length: 128 }),
    shippingCountry: varchar('shipping_country', { length: 2 }),
    shippingPostal: varchar('shipping_postal', { length: 32 }),
    fulfillmentStatus: varchar('fulfillment_status', { length: 32 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('cards_user_id_idx').on(t.userId),
    uniqueIndex('cards_processor_ref_uidx').on(t.processorRef),
  ],
);

export const virtualAccountStatusEnum = pgEnum('virtual_account_status', [
  'active',
  'closed',
]);

export const virtualAccounts = pgTable(
  'virtual_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    walletId: uuid('wallet_id')
      .notNull()
      .references(() => wallets.id),
    currency: varchar('currency', { length: 3 }).notNull(),
    provider: varchar('provider', { length: 64 }).notNull(),
    providerRef: varchar('provider_ref', { length: 128 }).notNull(),
    accountNumber: varchar('account_number', { length: 64 }).notNull(),
    routingNumber: varchar('routing_number', { length: 64 }),
    iban: varchar('iban', { length: 64 }),
    bic: varchar('bic', { length: 32 }),
    bankName: varchar('bank_name', { length: 128 }),
    accountName: varchar('account_name', { length: 255 }).notNull(),
    country: varchar('country', { length: 2 }).notNull(),
    status: virtualAccountStatusEnum('status').notNull().default('active'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('virtual_accounts_user_id_idx').on(t.userId),
    uniqueIndex('virtual_accounts_provider_ref_uidx').on(t.providerRef),
    uniqueIndex('virtual_accounts_user_currency_uidx').on(t.userId, t.currency),
  ],
);

export const orgRoleEnum = pgEnum('org_role', [
  'owner',
  'admin',
  'approver',
  'member',
]);

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  status: varchar('status', { length: 32 }).notNull().default('active'),
  approvalLimitMinor: bigint('approval_limit_minor', { mode: 'bigint' })
    .notNull()
    .default(sql`0`),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: orgRoleEnum('role').notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('org_members_org_user_uidx').on(t.organizationId, t.userId),
    index('org_members_user_id_idx').on(t.userId),
  ],
);

export const bulkPayoutStatusEnum = pgEnum('bulk_payout_status', [
  'draft',
  'pending_approval',
  'processing',
  'completed',
  'failed',
  'rejected',
]);

export const bulkPayoutBatches = pgTable(
  'bulk_payout_batches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    approvedByUserId: uuid('approved_by_user_id').references(() => users.id),
    currency: varchar('currency', { length: 8 }).notNull().default('NGN'),
    status: bulkPayoutStatusEnum('status').notNull().default('draft'),
    totalAmount: bigint('total_amount', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    itemCount: varchar('item_count', { length: 16 }).notNull().default('0'),
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('bulk_payout_batches_idem_uidx').on(t.idempotencyKey),
    index('bulk_payout_batches_org_idx').on(t.organizationId),
  ],
);

export const bulkPayoutItems = pgTable(
  'bulk_payout_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => bulkPayoutBatches.id),
    accountName: varchar('account_name', { length: 255 }).notNull(),
    accountNumber: varchar('account_number', { length: 64 }).notNull(),
    bankCode: varchar('bank_code', { length: 32 }),
    amount: bigint('amount', { mode: 'bigint' }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    transactionId: uuid('transaction_id').references(() => transactions.id),
    failureReason: text('failure_reason'),
  },
  (t) => [index('bulk_payout_items_batch_idx').on(t.batchId)],
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id),
    organizationId: uuid('organization_id').references(() => organizations.id),
    name: varchar('name', { length: 128 }).notNull(),
    keyPrefix: varchar('key_prefix', { length: 16 }).notNull(),
    keyHash: varchar('key_hash', { length: 128 }).notNull(),
    scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('api_keys_key_hash_uidx').on(t.keyHash),
    index('api_keys_user_id_idx').on(t.userId),
  ],
);

export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id),
    organizationId: uuid('organization_id').references(() => organizations.id),
    url: text('url').notNull(),
    secret: varchar('secret', { length: 128 }).notNull(),
    events: jsonb('events').$type<string[]>().notNull().default([]),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('webhook_endpoints_user_id_idx').on(t.userId)],
);

/** Phase 7 — Compliance & Risk */
export const complianceAlertStatusEnum = pgEnum('compliance_alert_status', [
  'open',
  'under_review',
  'dismissed',
  'confirmed',
]);

export const complianceAlerts = pgTable(
  'compliance_alerts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id),
    transactionId: uuid('transaction_id').references(() => transactions.id),
    ruleName: varchar('rule_name', { length: 128 }).notNull(),
    severity: varchar('severity', { length: 32 }).notNull().default('medium'),
    status: complianceAlertStatusEnum('status').notNull().default('open'),
    description: text('description').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('compliance_alerts_user_id_idx').on(t.userId),
    index('compliance_alerts_status_idx').on(t.status),
  ],
);

export const disputeStatusEnum = pgEnum('dispute_status', [
  'open',
  'under_investigation',
  'won',
  'lost',
  'reversed',
]);

export const cardDisputes = pgTable(
  'card_disputes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id),
    amount: bigint('amount', { mode: 'bigint' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    reason: varchar('reason', { length: 255 }).notNull(),
    status: disputeStatusEnum('status').notNull().default('open'),
    evidence: jsonb('evidence').$type<Record<string, unknown>>().default({}),
    resolutionNote: text('resolution_note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('card_disputes_user_id_idx').on(t.userId),
    index('card_disputes_transaction_id_idx').on(t.transactionId),
  ],
);

export const supportTicketStatusEnum = pgEnum('support_ticket_status', [
  'open',
  'in_progress',
  'waiting_customer',
  'resolved',
  'closed',
]);

export const supportTickets = pgTable(
  'support_tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    subject: varchar('subject', { length: 255 }).notNull(),
    status: supportTicketStatusEnum('status').notNull().default('open'),
    priority: varchar('priority', { length: 32 }).notNull().default('normal'),
    category: varchar('category', { length: 64 }).notNull().default('general'),
    assignedToUserId: uuid('assigned_to_user_id').references(() => users.id),
    relatedTransactionId: uuid('related_transaction_id').references(
      () => transactions.id,
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('support_tickets_user_id_idx').on(t.userId),
    index('support_tickets_status_idx').on(t.status),
  ],
);

export const supportTicketMessages = pgTable(
  'support_ticket_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => supportTickets.id),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    isStaff: boolean('is_staff').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('support_ticket_messages_ticket_id_idx').on(t.ticketId)],
);
