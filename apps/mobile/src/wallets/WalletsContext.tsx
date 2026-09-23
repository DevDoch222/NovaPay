import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '@/auth/AuthContext';
import type { FundResult, Transaction, Wallet } from '@/lib/money-types';
import type { BookFxResult, FxQuote, PayoutResult } from '@/lib/fx-send-api';
import { unwrapItems, type PaginatedResult } from '@/lib/api';

type WalletsContextValue = {
  wallets: Wallet[];
  transactions: Transaction[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  homeCurrency: string;
  setHomeCurrency: (code: string) => void;
  refresh: () => Promise<void>;
  fund: (amountMajor: number) => Promise<FundResult>;
  completeFund: (fundId: string) => Promise<Transaction>;
  fetchTxn: (id: string) => Promise<Transaction>;
  createQuote: (input: {
    sourceCurrency: string;
    destCurrency: string;
    sourceAmountMajor: number;
  }) => Promise<FxQuote>;
  bookQuote: (quoteId: string) => Promise<BookFxResult>;
  payout: (input: {
    beneficiaryId: string;
    amountMajor: number;
  }) => Promise<PayoutResult>;
  walletFor: (currency: string) => Wallet | undefined;
  totalInHomeCurrency: () => { minor: string; currency: string };
};

const WalletsContext = createContext<WalletsContextValue | null>(null);

export function WalletsProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, user, authFetch } = useAuth();
  const authFetchRef = useRef(authFetch);
  authFetchRef.current = authFetch;
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [homeCurrency, setHomeCurrency] = useState('NGN');
  const loadGen = useRef(0);

  const load = useCallback(async () => {
    if (!accessTokenRef.current) {
      setWallets([]);
      setTransactions([]);
      setError(null);
      return;
    }

    const gen = ++loadGen.current;
    setError(null);
    try {
      const [w, tBody] = await Promise.all([
        authFetchRef.current<Wallet[]>('/v1/wallets'),
        authFetchRef.current<PaginatedResult<Transaction> | Transaction[]>(
          '/v1/transactions?page=1&limit=50',
        ),
      ]);
      const t = unwrapItems(tBody);
      if (gen !== loadGen.current) return;
      setWallets(w);
      setTransactions(t);
      setHomeCurrency((current) => {
        if (w.length && !w.find((x) => x.currency === current)) {
          return w[0].currency;
        }
        return current;
      });
    } catch (e) {
      if (gen !== loadGen.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load wallets');
    }
  }, []);

  // Re-fetch only when the signed-in user changes — not on every access-token refresh
  useEffect(() => {
    if (!user?.id) {
      setWallets((prev) => (prev.length ? [] : prev));
      setTransactions((prev) => (prev.length ? [] : prev));
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void load().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id, load]);

  const softRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const fund = useCallback(async (amountMajor: number) => {
    const idempotencyKey = `fund-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return authFetchRef.current<FundResult>('/v1/payments/fund', {
      method: 'POST',
      body: { amountMajor, currency: 'NGN', idempotencyKey },
    });
  }, []);

  const completeFund = useCallback(
    async (fundId: string) => {
      const txn = await authFetchRef.current<Transaction>(
        `/v1/payments/fund/${fundId}/simulate-complete`,
        { method: 'POST' },
      );
      await load();
      return txn;
    },
    [load],
  );

  const fetchTxn = useCallback(
    async (id: string) => authFetchRef.current<Transaction>(`/v1/transactions/${id}`),
    [],
  );

  const createQuote = useCallback(
    async (input: {
      sourceCurrency: string;
      destCurrency: string;
      sourceAmountMajor: number;
    }) =>
      authFetchRef.current<FxQuote>('/v1/fx/quotes', {
        method: 'POST',
        body: input,
      }),
    [],
  );

  const bookQuote = useCallback(
    async (quoteId: string) => {
      const result = await authFetchRef.current<BookFxResult>(
        `/v1/fx/quotes/${quoteId}/book`,
        {
          method: 'POST',
          body: {
            idempotencyKey: `fx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          },
        },
      );
      await load();
      return result;
    },
    [load],
  );

  const payout = useCallback(
    async (input: { beneficiaryId: string; amountMajor: number }) => {
      const result = await authFetchRef.current<PayoutResult>('/v1/payments/payout', {
        method: 'POST',
        body: {
          ...input,
          idempotencyKey: `payout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
      });
      await load();
      return result;
    },
    [load],
  );

  const walletFor = useCallback(
    (currency: string) => wallets.find((w) => w.currency === currency),
    [wallets],
  );

  const totalInHomeCurrency = useCallback(() => {
    const w = wallets.find((x) => x.currency === homeCurrency);
    return {
      minor: w?.balanceMinor ?? '0',
      currency: homeCurrency,
    };
  }, [wallets, homeCurrency]);

  const value = useMemo<WalletsContextValue>(
    () => ({
      wallets,
      transactions,
      loading,
      refreshing,
      error,
      homeCurrency,
      setHomeCurrency,
      refresh: softRefresh,
      fund,
      completeFund,
      fetchTxn,
      createQuote,
      bookQuote,
      payout,
      walletFor,
      totalInHomeCurrency,
    }),
    [
      wallets,
      transactions,
      loading,
      refreshing,
      error,
      homeCurrency,
      softRefresh,
      fund,
      completeFund,
      fetchTxn,
      createQuote,
      bookQuote,
      payout,
      walletFor,
      totalInHomeCurrency,
    ],
  );

  return (
    <WalletsContext.Provider value={value}>{children}</WalletsContext.Provider>
  );
}

export function useWallets() {
  const ctx = useContext(WalletsContext);
  if (!ctx) throw new Error('useWallets must be used within WalletsProvider');
  return ctx;
}
