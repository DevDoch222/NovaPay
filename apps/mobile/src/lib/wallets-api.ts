import { apiFetch, unwrapItems, type PaginatedResult } from './api';
import type { FundResult, Transaction, Wallet } from './money-types';

export function listWallets(token: string) {
  return apiFetch<Wallet[]>('/v1/wallets', { token });
}

export async function listTransactions(token: string, limit = 50) {
  const body = await apiFetch<PaginatedResult<Transaction> | Transaction[]>(
    `/v1/transactions?page=1&limit=${limit}`,
    { token },
  );
  return unwrapItems(body);
}

export function getTransaction(token: string, id: string) {
  return apiFetch<Transaction>(`/v1/transactions/${id}`, { token });
}

export function fundWallet(
  token: string,
  input: { amountMajor: number; currency?: string; idempotencyKey: string },
) {
  return apiFetch<FundResult>('/v1/payments/fund', {
    method: 'POST',
    token,
    body: input,
  });
}

export function simulateFundComplete(token: string, fundId: string) {
  return apiFetch<Transaction>(`/v1/payments/fund/${fundId}/simulate-complete`, {
    method: 'POST',
    token,
  });
}

export function getRail(token: string) {
  return apiFetch<{ rail: string }>('/v1/payments/rail', { token });
}
