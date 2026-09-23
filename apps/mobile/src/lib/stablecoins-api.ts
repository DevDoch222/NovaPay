/** Stablecoin sandbox API types — /v1/stablecoins */

export type StableAsset = 'USDC' | 'USDT';

export type StableSupported = {
  assets: StableAsset[];
  note: string;
};

export type StableBalance = {
  currency: StableAsset;
  walletId: string;
  balanceMinor: string;
};

export type StableDepositResult = {
  transactionId: string;
  currency: string;
  amountMinor: string;
  balanceMinor: string;
};

export type StableConvertResult = {
  transactionId: string;
  sourceCurrency: string;
  destCurrency: string;
  amountMinor: string;
  sourceBalanceMinor: string;
  destBalanceMinor: string;
};
