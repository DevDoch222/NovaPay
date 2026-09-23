/** Minor units (kobo/cents) ↔ display helpers */

export function minorToMajor(minor: string | number | bigint): number {
  const n = typeof minor === 'bigint' ? minor : BigInt(String(minor));
  return Number(n) / 100;
}

export function majorToMinor(major: number): bigint {
  return BigInt(Math.round(major * 100));
}

const currencySymbols: Record<string, string> = {
  NGN: '₦',
  USD: '$',
  EUR: '€',
  GBP: '£',
  USDC: 'USDC ',
  USDT: 'USDT ',
};

export function currencySymbol(code: string) {
  return currencySymbols[code] ?? `${code} `;
}

/** Format minor amount for display with tabular-friendly grouping */
export function formatMoney(
  minor: string | number | bigint,
  currency: string,
  opts?: { showCode?: boolean; signed?: boolean },
): string {
  const major = minorToMajor(minor);
  const abs = Math.abs(major);
  const formatted = abs.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = opts?.signed ? (major < 0 ? '−' : major > 0 ? '+' : '') : '';
  const body = `${currencySymbol(currency)}${formatted}`;
  const withCode = opts?.showCode ? `${body} ${currency}` : body;
  return `${sign}${withCode}`;
}

export function formatDayHeading(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (startToday.getTime() - startThat.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
