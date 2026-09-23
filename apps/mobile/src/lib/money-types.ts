export type Wallet = {
  id: string;
  currency: string;
  status: string;
  balanceMinor: string;
  createdAt: string;
};

export type TxnType =
  | 'fund'
  | 'payout'
  | 'transfer'
  | 'reversal'
  | 'adjustment'
  | 'fx_debit'
  | 'fx_credit'
  | 'card_auth'
  | 'card_settle'
  | 'card_release'
  | 'bill_payment'
  | 'airtime'
  | 'stablecoin_deposit'
  | 'stablecoin_convert'
  | string;

export type TxnStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'reversed'
  | string;

export type Transaction = {
  id: string;
  type: TxnType;
  status: TxnStatus;
  amountMinor: string;
  feeMinor: string;
  currency: string;
  externalReference: string | null;
  beneficiaryId: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  balanceMinor?: string;
};

export type FundResult = {
  id: string;
  status: string;
  amountMinor: string;
  currency: string;
  rail: string;
  externalReference: string | null;
  paymentLink: string | null;
  nextStep: string;
};
