import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import {
  Screen,
  Text,
  MoneyText,
  Button,
  StatusPill,
  SuccessExperience,
} from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { useWallets } from '@/wallets/WalletsContext';
import { type FxQuote, type FxRate } from '@/lib/fx-send-api';
import { currencySymbol, formatMoney, minorToMajor } from '@/lib/money';
import { ApiError } from '@/lib/api';
import { colors, radii, space } from '@/theme';

type Step = 'amount' | 'quote' | 'done';
type Fiat = 'NGN' | 'USD' | 'EUR';

const FIATS: Fiat[] = ['NGN', 'USD', 'EUR'];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'] as const;

export default function ConvertScreen() {
  const { user, unlocked, authFetch } = useAuth();
  const { walletFor, createQuote, bookQuote } = useWallets();
  const [source, setSource] = useState<Fiat>('NGN');
  const [dest, setDest] = useState<Fiat>('USD');
  const [picking, setPicking] = useState<'source' | 'dest' | null>(null);
  const [digits, setDigits] = useState('');
  const [step, setStep] = useState<Step>('amount');
  const [rateLabel, setRateLabel] = useState<string | null>(null);
  const [quote, setQuote] = useState<FxQuote | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    destMinor: string;
    destCurrency: string;
  } | null>(null);

  const amountMajor = useMemo(() => Number(digits || '0') || 0, [digits]);
  const sourceWallet = walletFor(source);
  const available = sourceWallet?.balanceMinor ?? '0';

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void authFetch<FxRate>(
      `/v1/fx/rate?source=${encodeURIComponent(source)}&dest=${encodeURIComponent(dest)}`,
    )
      .then((r) => {
        if (!cancelled) {
          setRateLabel(
            `1 ${source} → ${Number(r.clientRate).toPrecision(6)} ${dest} (incl. margin)`,
          );
        }
      })
      .catch(() => {
        if (!cancelled) setRateLabel(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, source, dest]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!quote || step !== 'quote') return;
    const tick = () => {
      const left = Math.max(
        0,
        Math.floor((new Date(quote.expiresAt).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(left);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [quote, step]);

  useEffect(() => {
    if (!user || !unlocked) router.replace('/');
  }, [user, unlocked]);

  if (!user || !unlocked) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />
      </Screen>
    );
  }

  function onKey(key: string) {
    if (key === '') return;
    if (key === '⌫') {
      setDigits((d) => d.slice(0, -1));
      return;
    }
    if (digits.length >= 9) return;
    setDigits((d) => (d === '0' ? key : d + key));
  }

  function swapPair() {
    setSource(dest);
    setDest(source);
    setDigits('');
    setQuote(null);
    setStep('amount');
    setError(null);
    setPicking(null);
  }

  function selectCurrency(code: Fiat) {
    if (picking === 'source') {
      if (code === dest) setDest(source);
      setSource(code);
    } else if (picking === 'dest') {
      if (code === source) setSource(dest);
      setDest(code);
    }
    setDigits('');
    setQuote(null);
    setError(null);
    setPicking(null);
  }

  async function requestQuote() {
    if (amountMajor < 1) {
      setError('Enter an amount of at least 1');
      return;
    }
    if (minorToMajor(available) < amountMajor) {
      setError(`Insufficient ${source} balance`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = await createQuote({
        sourceCurrency: source,
        destCurrency: dest,
        sourceAmountMajor: amountMajor,
      });
      setQuote(q);
      setStep('quote');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not fetch quote');
    } finally {
      setLoading(false);
    }
  }

  async function confirmBook() {
    if (!quote) return;
    if (secondsLeft <= 0) {
      setError('Quote expired — get a new quote');
      setStep('amount');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const booked = await bookQuote(quote.id);
      setResult({
        destMinor: booked.quote.destAmountMinor,
        destCurrency: booked.quote.destCurrency,
      });
      setStep('done');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Conversion failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text variant="bodyMedium" color={colors.accent}>
            Close
          </Text>
        </Pressable>
        <Text variant="h3">Convert</Text>
        <View style={{ width: 48 }} />
      </View>

      {step === 'amount' ? (
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pairRow}>
            <Pill
              label={source}
              active={picking === 'source'}
              onPress={() =>
                setPicking((p) => (p === 'source' ? null : 'source'))
              }
            />
            <Pressable onPress={swapPair} style={styles.swap}>
              <Text variant="h3" color={colors.accent}>
                ⇄
              </Text>
            </Pressable>
            <Pill
              label={dest}
              active={picking === 'dest'}
              onPress={() => setPicking((p) => (p === 'dest' ? null : 'dest'))}
            />
          </View>

          {picking ? (
            <View style={styles.picker}>
              <Text variant="caption" color={colors.textSecondary} style={styles.center}>
                Choose {picking === 'source' ? 'from' : 'to'} currency
              </Text>
              <View style={styles.chipRow}>
                {FIATS.map((code) => {
                  const selected =
                    (picking === 'source' && code === source) ||
                    (picking === 'dest' && code === dest);
                  return (
                    <Pressable
                      key={code}
                      style={[styles.chip, selected && styles.chipActive]}
                      onPress={() => selectCurrency(code)}
                    >
                      <Text
                        variant="bodyMedium"
                        color={selected ? colors.textOnPrimary : colors.text}
                      >
                        {code}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <Text variant="caption" color={colors.textSecondary} style={styles.center}>
            Available {formatMoney(available, source)}
          </Text>
          <MoneyText size="lg" style={styles.amount}>
            {currencySymbol(source)}
            {amountMajor.toLocaleString('en-NG')}
          </MoneyText>
          {rateLabel ? (
            <Text variant="caption" color={colors.textMuted} style={styles.center}>
              {rateLabel}
            </Text>
          ) : null}
          <Text variant="caption" color={colors.textMuted} style={styles.center}>
            NGN · USD · EUR · tap a currency to change
          </Text>
          <View style={styles.keypad}>
            {KEYS.map((k, i) => (
              <Pressable
                key={`${k}-${i}`}
                style={[styles.key, k === '' && styles.keyGhost]}
                onPress={() => onKey(k)}
                disabled={k === ''}
              >
                <Text variant="h2">{k}</Text>
              </Pressable>
            ))}
          </View>
          {error ? (
            <Text variant="caption" color={colors.error}>
              {error}
            </Text>
          ) : null}
          <Button
            label={loading ? 'Getting quote…' : 'Get locked quote'}
            fullWidth
            loading={loading}
            disabled={amountMajor < 1}
            onPress={requestQuote}
          />
        </ScrollView>
      ) : null}

      {step === 'quote' && quote ? (
        <View style={styles.body}>
          <StatusPill
            label={secondsLeft > 0 ? `Locked · ${secondsLeft}s left` : 'Expired'}
            tone={secondsLeft > 0 ? 'info' : 'warning'}
          />
          <Text variant="h1" style={{ marginTop: space.sm }}>
            Review conversion
          </Text>
          <View style={styles.summary}>
            <Row
              label="You convert"
              value={formatMoney(quote.sourceAmountMinor, quote.sourceCurrency)}
            />
            <Row
              label="You receive"
              value={formatMoney(quote.destAmountMinor, quote.destCurrency)}
              bold
            />
            <Row label="Client rate" value={Number(quote.clientRate).toPrecision(6)} />
            <Row label="Mid market" value={Number(quote.midRate).toPrecision(6)} />
            <Row label="Margin" value={`${quote.marginBps} bps`} />
          </View>
          <Text variant="secondary">
            Rate is locked until expiry. Booking debits {quote.sourceCurrency} and
            credits {quote.destCurrency} immediately. {quote.marginDisclosure ??
              `Includes ${quote.marginBps} bps NovaPay FX margin vs mid-market.`}
          </Text>
          {error ? (
            <Text variant="caption" color={colors.error}>
              {error}
            </Text>
          ) : null}
          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: space.md }} />
          ) : (
            <Button
              label="Confirm convert"
              fullWidth
              disabled={secondsLeft <= 0}
              onPress={confirmBook}
            />
          )}
          <Button
            label="Back"
            variant="ghost"
            fullWidth
            disabled={loading}
            onPress={() => setStep('amount')}
          />
        </View>
      ) : null}

      {step === 'done' && result ? (
        <SuccessExperience
          badge="Converted"
          title="Exchange complete"
          subtitle={`${source} → ${dest} at your locked quote.`}
          amount={formatMoney(result.destMinor, result.destCurrency)}
          amountCurrency={result.destCurrency}
          meta={[
            {
              label: 'You sold',
              value: `${currencySymbol(source)}${amountMajor.toLocaleString('en-NG')}.00`,
            },
            {
              label: 'You received',
              value: formatMoney(result.destMinor, result.destCurrency),
            },
            { label: 'Pair', value: `${source} → ${dest}` },
          ]}
          primaryLabel="Done"
          onPrimary={() => router.replace('/(tabs)')}
          secondaryLabel="Convert again"
          onSecondary={() => {
            setStep('amount');
            setResult(null);
            setQuote(null);
          }}
        />
      ) : null}
    </Screen>
  );
}

function Pill({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive]}
    >
      <Text
        variant="bodyMedium"
        color={active ? colors.textOnPrimary : colors.text}
      >
        {label} ▾
      </Text>
    </Pressable>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text variant="caption">{label}</Text>
      <Text variant={bold ? 'bodyMedium' : 'body'}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
    marginBottom: space.lg,
  },
  body: { flexGrow: 1, gap: space.sm, paddingBottom: space.lg },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    marginBottom: space.sm,
  },
  pill: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
    minWidth: 88,
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: colors.primary,
  },
  picker: {
    gap: space.sm,
    marginBottom: space.xs,
  },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.sm,
  },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  swap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  amount: { textAlign: 'center', marginVertical: space.sm },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: space.sm },
  key: {
    width: '33.33%',
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyGhost: { opacity: 0 },
  summary: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
    padding: space.md,
    gap: space.sm,
    marginVertical: space.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
