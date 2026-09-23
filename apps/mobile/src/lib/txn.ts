import type { Transaction, TxnStatus, TxnType } from '@/lib/money-types';

export function txnTitle(type: TxnType): string {
  switch (type) {
    case 'fund':
      return 'Add money';
    case 'payout':
      return 'Sent';
    case 'transfer':
      return 'Transfer';
    case 'convert':
    case 'fx_debit':
    case 'fx_credit':
      return 'Convert';
    case 'card_auth':
    case 'card_settle':
      return 'Card spend';
    case 'card_release':
      return 'Card hold released';
    case 'bill_payment':
      return 'Bill payment';
    case 'airtime':
      return 'Airtime';
    case 'stablecoin_deposit':
      return 'Crypto deposit';
    case 'stablecoin_convert':
      return 'Crypto convert';
    case 'reversal':
      return 'Reversal';
    default:
      return type.replace(/_/g, ' ');
  }
}

export function isInbound(type: TxnType): boolean {
  return (
    type === 'fund' ||
    type === 'fx_credit' ||
    type === 'card_release' ||
    type === 'reversal' ||
    type === 'stablecoin_deposit'
  );
}

export function statusTone(
  status: TxnStatus,
): 'success' | 'warning' | 'error' | 'neutral' | 'info' {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'error';
  if (status === 'pending' || status === 'processing') return 'warning';
  return 'neutral';
}

export type ActivityFilter =
  | 'all'
  | 'sent'
  | 'received'
  | 'converted'
  | 'card';

export function matchesFilter(txn: Transaction, filter: ActivityFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'sent') return txn.type === 'payout' || txn.type === 'transfer';
  if (filter === 'received') return txn.type === 'fund';
  if (filter === 'converted')
    return (
      txn.type === 'convert' ||
      txn.type === 'fx_debit' ||
      txn.type === 'fx_credit'
    );
  if (filter === 'card')
    return (
      txn.type === 'card_auth' ||
      txn.type === 'card_settle' ||
      txn.type === 'card_release'
    );
  return true;
}
