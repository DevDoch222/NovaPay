export type RailInitiateResult = {
  providerRef: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  paymentLink?: string;
  message?: string;
};

export type CollectionInput = {
  amountMinor: bigint;
  currency: string;
  userId: string;
  reference: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
};

export type PayoutInput = {
  amountMinor: bigint;
  currency: string;
  accountNumber: string;
  bankCode?: string | null;
  accountName: string;
  reference: string;
  narration?: string;
};

export interface PaymentRailProvider {
  readonly name: string;
  initiateCollection(input: CollectionInput): Promise<RailInitiateResult>;
  initiatePayout(input: PayoutInput): Promise<RailInitiateResult>;
}

export const PAYMENT_RAIL = Symbol('PAYMENT_RAIL');
