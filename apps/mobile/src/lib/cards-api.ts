/** Card API types — mirrors GET/POST /v1/cards responses */

export type CardStatus = 'active' | 'frozen' | 'closed';
export type CardForm = 'virtual' | 'physical';

export type NovaCard = {
  id: string;
  brand: string;
  last4: string;
  expMonth: string;
  expYear: string;
  status: CardStatus;
  form: CardForm;
  currency: string;
  walletId: string;
  spendLimitMinor: string | null;
  label: string | null;
  fulfillmentStatus: string | null;
  shipping: {
    name: string | null;
    line1: string | null;
    city: string | null;
    country: string | null;
    postal: string | null;
  } | null;
  processorRef: string;
  createdAt: string;
};

export type CardAuthorizeResult = {
  authorizationId: string;
  status: string;
  amountMinor: string;
  currency: string;
  merchant: string;
  balanceMinor: string;
};

export type CardSettleResult = {
  authorizationId: string;
  settlementId: string;
  status: string;
  amountMinor: string;
  currency: string;
};

export type IssueCardInput = {
  label?: string;
  spendLimitMajor?: number;
  form?: CardForm;
  shippingName?: string;
  shippingLine1?: string;
  shippingCity?: string;
  shippingCountry?: string;
  shippingPostal?: string;
};

const FULFILLMENT_LABELS: Record<string, string> = {
  pending_print: 'Preparing your card',
  printed: 'Printed',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

export function formatFulfillmentStatus(status: string | null): string {
  if (!status) return '—';
  return FULFILLMENT_LABELS[status] ?? status.replace(/_/g, ' ');
}
