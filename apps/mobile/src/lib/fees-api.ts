import { apiFetch } from './api';

export type FeeQuote = {
  type: string;
  currency: string;
  amountMinor: string;
  feeMinor: string;
  netMinor: string;
  bps: number;
  flatMinor: string;
  disclosure: string;
};

export function getFeeQuote(
  token: string,
  input: { type: string; amountMajor: number; currency: string },
) {
  const qs = new URLSearchParams({
    type: input.type,
    amountMajor: String(input.amountMajor),
    currency: input.currency.toUpperCase(),
  });
  return apiFetch<FeeQuote>(`/v1/fees/quote?${qs.toString()}`, { token });
}

export function formatMinorAsNaira(minor: string | number | bigint): string {
  const n = Number(minor) / 100;
  return `₦${n.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
