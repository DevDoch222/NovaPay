/** Bills, airtime, and virtual receive account types */

export type Biller = {
  id: string;
  country: string;
  category: string;
  name: string;
  currency: string;
};

export type AirtimeOperator = {
  id: string;
  country: string;
  name: string;
  currency: string;
};

export type BillPayResult = {
  id: string;
  status: string;
  amountMinor: string;
  currency: string;
  biller: { id: string; name: string };
  customerRef: string;
  providerRef: string;
  balanceMinor: string;
};

export type AirtimeResult = {
  id: string;
  status: string;
  amountMinor: string;
  currency: string;
  operator: { id: string; name: string };
  phone: string;
  providerRef: string;
  balanceMinor: string;
};

export type VirtualAccount = {
  id: string;
  currency: string;
  accountNumber: string;
  routingNumber: string | null;
  iban: string | null;
  bic: string | null;
  bankName: string;
  accountName: string;
  country: string;
  provider: string;
  providerRef: string;
  status: string;
  instructions: string;
  createdAt: string;
};

export type InboundCreditResult = {
  transactionId: string;
  status: string;
  amountMinor: string;
  currency: string;
  balanceMinor: string;
  virtualAccountId: string;
};
