export type FeeTransactionType =
  'fund' | 'payout' | 'card_spend' | 'card_issue' | 'bill' | 'airtime';

export type FeeRule = {
  type: FeeTransactionType;
  currency: string;
  bps: number;
  flatMinor: bigint;
  minFeeMinor: bigint;
  maxFeeMinor: bigint | null;
};

export type FeeQuote = {
  type: FeeTransactionType;
  currency: string;
  amountMinor: string;
  feeMinor: string;
  /** User debit for payout = amount + fee; wallet credit for fund = amount - fee */
  netMinor: string;
  bps: number;
  flatMinor: string;
  disclosure: string;
};
