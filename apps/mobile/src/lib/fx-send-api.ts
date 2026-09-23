import { apiFetch, unwrapItems, type PaginatedResult } from './api';

export type FxRate = {
  sourceCurrency: string;
  destCurrency: string;
  midRate: string;
  clientRate: string;
  marginBps: number;
  rateMeaning: string;
};

export type FxQuote = {
  id: string;
  sourceCurrency: string;
  destCurrency: string;
  sourceAmountMinor: string;
  destAmountMinor: string;
  midRate: string;
  clientRate: string;
  marginBps: string;
  status: string;
  expiresAt: string;
  bookedTransactionId: string | null;
  marginDisclosure?: string;
};

export type BookFxResult = {
  quote: FxQuote;
  transactionId: string;
  sourceBalanceMinor: string;
  destBalanceMinor: string;
};

export type Beneficiary = {
  id: string;
  type: 'bank' | 'mobile_money';
  country: string;
  currency: string;
  accountName: string;
  accountNumber: string;
  bankCode: string | null;
  bankName: string | null;
  provider: string | null;
  label: string | null;
  isActive: boolean;
  createdAt: string;
};

export type PayoutResult = {
  id: string;
  type: string;
  status: string;
  amountMinor: string;
  feeMinor: string;
  currency: string;
  rail: string;
  channel: string;
  balanceMinor: string;
};

/** Common Nigerian banks when Flutterwave bank list is unavailable */
export const SANDBOX_NG_BANKS = [
  { code: '058', name: 'GTBank' },
  { code: '044', name: 'Access Bank' },
  { code: '033', name: 'UBA' },
  { code: '057', name: 'Zenith Bank' },
  { code: '011', name: 'First Bank' },
  { code: '032', name: 'Union Bank' },
  { code: '221', name: 'Stanbic IBTC' },
] as const;

export function getFxRate(
  token: string,
  source: string,
  dest: string,
) {
  return apiFetch<FxRate>(
    `/v1/fx/rate?source=${encodeURIComponent(source)}&dest=${encodeURIComponent(dest)}`,
    { token },
  );
}

export function createFxQuote(
  token: string,
  input: {
    sourceCurrency: string;
    destCurrency: string;
    sourceAmountMajor: number;
  },
) {
  return apiFetch<FxQuote>('/v1/fx/quotes', {
    method: 'POST',
    token,
    body: input,
  });
}

export function bookFxQuote(
  token: string,
  quoteId: string,
  idempotencyKey: string,
) {
  return apiFetch<BookFxResult>(`/v1/fx/quotes/${quoteId}/book`, {
    method: 'POST',
    token,
    body: { idempotencyKey },
  });
}

export async function listBeneficiaries(token: string) {
  const body = await apiFetch<PaginatedResult<Beneficiary> | Beneficiary[]>(
    '/v1/beneficiaries',
    { token },
  );
  return unwrapItems(body);
}

export function createBeneficiary(
  token: string,
  input: {
    type: 'bank' | 'mobile_money';
    accountName: string;
    accountNumber: string;
    bankCode?: string;
    bankName?: string;
    provider?: string;
    country?: string;
    currency?: string;
    label?: string;
  },
) {
  return apiFetch<Beneficiary>('/v1/beneficiaries', {
    method: 'POST',
    token,
    body: input,
  });
}

export function createPayout(
  token: string,
  input: {
    beneficiaryId: string;
    amountMajor: number;
    idempotencyKey: string;
  },
) {
  return apiFetch<PayoutResult>('/v1/payments/payout', {
    method: 'POST',
    token,
    body: input,
  });
}
