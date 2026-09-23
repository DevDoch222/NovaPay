/** Base fiat for Phase 1 corridor */
export const MVP_CURRENCY = 'NGN' as const;
export const MVP_COUNTRY = 'NG' as const;
export const USD_CURRENCY = 'USD' as const;
export const EUR_CURRENCY = 'EUR' as const;
export const USDC_CURRENCY = 'USDC' as const;
export const USDT_CURRENCY = 'USDT' as const;

export const SUPPORTED_CURRENCIES = [
  'NGN',
  'USD',
  'EUR',
  'USDC',
  'USDT',
] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/** Amounts are stored in minor units (kobo / cents). Stablecoins use 6 decimals internally as integer micros?
 *  Phase 4 sandbox: treat USDC/USDT like USD cents (2 decimals) for simpler ledger. */
export const CURRENCY_DECIMALS: Record<string, number> = {
  NGN: 2,
  USD: 2,
  EUR: 2,
  KES: 2,
  GHS: 2,
  USDC: 2,
  USDT: 2,
};

export const KYC_LIMITS = {
  tier_0: {
    maxSinglePayoutMinor: 0n,
    maxDailyPayoutMinor: 0n,
    maxMonthlyPayoutMinor: 0n,
    maxSingleFundMinor: 10_000_00n,
    maxDailyFundMinor: 20_000_00n,
    maxMonthlyFundMinor: 50_000_00n,
    maxWalletBalanceMinor: 50_000_00n,
  },
  tier_1: {
    maxSinglePayoutMinor: 200_000_00n,
    maxDailyPayoutMinor: 500_000_00n,
    maxMonthlyPayoutMinor: 2_000_000_00n,
    maxSingleFundMinor: 500_000_00n,
    maxDailyFundMinor: 1_000_000_00n,
    maxMonthlyFundMinor: 5_000_000_00n,
    maxWalletBalanceMinor: 2_000_000_00n,
  },
  tier_2: {
    maxSinglePayoutMinor: 5_000_000_00n,
    maxDailyPayoutMinor: 10_000_000_00n,
    maxMonthlyPayoutMinor: 50_000_000_00n,
    maxSingleFundMinor: 10_000_000_00n,
    maxDailyFundMinor: 20_000_000_00n,
    maxMonthlyFundMinor: 100_000_000_00n,
    maxWalletBalanceMinor: 50_000_000_00n,
  },
} as const;

export type KycTier = keyof typeof KYC_LIMITS;

export const SYSTEM_WALLET_KEYS = {
  CLEARING_INBOUND: 'clearing_inbound',
  CLEARING_OUTBOUND: 'clearing_outbound',
  FEES: 'fees',
  FX_CLEARING: 'fx_clearing',
  CARD_HOLDS: 'card_holds',
  CARD_SETTLEMENT: 'card_settlement',
  BILLS: 'bills_clearing',
  STABLECOIN_CLEARING: 'stablecoin_clearing',
} as const;

/** Default mid-market USDNGN when no live feed (NGN per 1 USD). */
export const DEFAULT_USD_NGN_MID = 1600;

/** Default mid EUR per 1 USD when no live feed. */
export const DEFAULT_USD_EUR_MID = 0.92;

/** Fiat pairs convertible via /v1/fx (stablecoins stay on /v1/stablecoins). */
export const FX_FIAT_CURRENCIES = ['NGN', 'USD', 'EUR'] as const;
export type FxFiatCurrency = (typeof FX_FIAT_CURRENCIES)[number];

export const MOMO_PROVIDERS = ['mtn', 'airtel', 'mpesa', 'vodafone'] as const;

export type MomoProvider = (typeof MOMO_PROVIDERS)[number];

export const API_SCOPES = [
  'wallets:read',
  'transactions:read',
  'payouts:write',
  'webhooks:write',
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

/** Phase 3 bill / airtime catalog (sandbox). */
export const BILL_CATALOG = [
  {
    id: 'ng-ikedc',
    country: 'NG',
    category: 'electricity',
    name: 'IKEDC Electricity',
    currency: 'NGN',
  },
  {
    id: 'ng-dstv',
    country: 'NG',
    category: 'tv',
    name: 'DStv',
    currency: 'NGN',
  },
  {
    id: 'ng-gotv',
    country: 'NG',
    category: 'tv',
    name: 'GOtv',
    currency: 'NGN',
  },
  {
    id: 'ke-kplc',
    country: 'KE',
    category: 'electricity',
    name: 'Kenya Power',
    currency: 'KES',
  },
] as const;

export const AIRTIME_OPERATORS = [
  { id: 'ng-mtn', country: 'NG', name: 'MTN Nigeria', currency: 'NGN' },
  { id: 'ng-airtel', country: 'NG', name: 'Airtel Nigeria', currency: 'NGN' },
  { id: 'ng-glo', country: 'NG', name: 'Glo Nigeria', currency: 'NGN' },
  { id: 'ke-safaricom', country: 'KE', name: 'Safaricom', currency: 'KES' },
] as const;
