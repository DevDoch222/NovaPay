export type OrgRole = 'owner' | 'admin' | 'approver' | 'member';

export type Organization = {
  id: string;
  name: string;
  slug: string;
  status: string;
  approvalLimitMinor: string;
  createdAt: string;
  role?: OrgRole;
};

export type OrgMember = {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgRole;
  createdAt: string;
  tag?: string | null;
  phone?: string | null;
};

export type OrgWallet = {
  walletId: string;
  currency: string;
  balanceMinor: string;
};

export type BulkBatchSummary = {
  id: string;
  status: string;
  currency: string;
  totalAmountMinor: string;
  itemCount: string;
  createdByUserId: string;
  createdAt: string;
};

export type BulkBatchDetail = BulkBatchSummary & {
  approvedByUserId?: string | null;
  items: Array<{
    id: string;
    accountName: string;
    accountNumber: string;
    bankCode?: string | null;
    amountMinor: string;
    status: string;
    transactionId?: string | null;
    failureReason?: string | null;
  }>;
};

export function canManageOrg(role?: OrgRole) {
  return role === 'owner' || role === 'admin';
}

export function canApprovePayouts(role?: OrgRole) {
  return role === 'owner' || role === 'admin' || role === 'approver';
}

export function idemKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
