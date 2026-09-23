import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import {
  Screen,
  Text,
  MoneyText,
  Button,
  BottomSheet,
  StatusPill,
  SuccessExperience,
} from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { useWallets } from '@/wallets/WalletsContext';
import { formatMoney } from '@/lib/money';
import { ApiError } from '@/lib/api';
import {
  formatMinorAsNaira,
  getFeeQuote,
  type FeeQuote,
} from '@/lib/fees-api';
import { colors, radii, space } from '@/theme';

type Method = 'bank' | 'card' | 'momo';
type Step = 'method' | 'amount' | 'confirm' | 'done';

const METHODS: { id: Method; label: string; hint: string }[] = [
  { id: 'bank', label: 'Bank transfer', hint: 'Sandbox credits instantly after confirm' },
  { id: 'card', label: 'Debit / credit card', hint: 'Same mock rail in this build' },
  { id: 'momo', label: 'Mobile money', hint: 'Same mock rail in this build' },
];

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'] as const;

export default function FundScreen() {
  const { user, unlocked, accessToken } = useAuth();
  const { fund, completeFund } = useWallets();
  const [step, setStep] = useState<Step>('method');
  const [method, setMethod] = useState<Method>('bank');
  const [digits, setDigits] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [credited, setCredited] = useState<string | null>(null);
  const [methodSheet, setMethodSheet] = useState(false);
  const [feeQuote, setFeeQuote] = useState<FeeQuote | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);

  const amountMajor = useMemo(() => {
    const n = Number(digits || '0');
    return Number.isFinite(n) ? n : 0;
  }, [digits]);

  useEffect(() => {
    if (!user || !unlocked) router.replace('/');
  }, [user, unlocked]);

  useEffect(() => {
    if (step !== 'confirm' || !accessToken || amountMajor < 1) {
      setFeeQuote(null);
      return;
    }
    let cancelled = false;
    setFeeLoading(true);
    void getFeeQuote(accessToken, {
      type: 'fund',
      amountMajor,
      currency: 'NGN',
    })
      .then((q) => {
        if (!cancelled) setFeeQuote(q);
      })
      .catch((e) => {
        if (!cancelled) {
          setFeeQuote(null);
          setError(e instanceof ApiError ? e.message : 'Could not load fee');
        }
      })
      .finally(() => {
        if (!cancelled) setFeeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, accessToken, amountMajor]);

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
    if (digits === '0') {
      setDigits(key);
      return;
    }
    setDigits((d) => d + key);
  }

  async function onConfirm() {
    if (amountMajor < 1) {
      setError('Enter at least ₦1');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const pending = await fund(amountMajor);
      const done = await completeFund(pending.id);
      setCredited(done.amountMinor);
      setStep('done');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Funding failed');
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
        <Text variant="h3">Add money</Text>
        <View style={{ width: 48 }} />
      </View>

      {step === 'method' ? (
        <View style={styles.body}>
          <Text variant="h1">How are you funding?</Text>
          <Text variant="secondary" style={styles.sub}>
            Fees and arrival time are shown before you confirm. Sandbox credits NGN only.
          </Text>
          {METHODS.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => {
                setMethod(m.id);
                setStep('amount');
              }}
              style={styles.methodRow}
            >
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">{m.label}</Text>
                <Text variant="caption">{m.hint}</Text>
              </View>
              <Text variant="h3" color={colors.accent}>
                →
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {step === 'amount' ? (
        <View style={styles.body}>
          <Pressable onPress={() => setMethodSheet(true)} style={styles.methodChip}>
            <Text variant="caption" color={colors.accent}>
              {METHODS.find((m) => m.id === method)?.label} · change
            </Text>
          </Pressable>
          <Text variant="caption" color={colors.textSecondary} style={styles.currencyLabel}>
            Amount · NGN
          </Text>
          <MoneyText size="lg" style={styles.amount}>
            ₦{amountMajor.toLocaleString('en-NG')}
          </MoneyText>
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
            label="Continue"
            fullWidth
            disabled={amountMajor < 1}
            onPress={() => {
              setError(null);
              setStep('confirm');
            }}
          />
        </View>
      ) : null}

      {step === 'confirm' ? (
        <View style={styles.body}>
          <Text variant="h1">Confirm deposit</Text>
          <Text variant="secondary" style={styles.sub}>
            Review amount before we credit your NGN wallet.
          </Text>
          <View style={styles.summary}>
            <Row label="Method" value={METHODS.find((m) => m.id === method)?.label ?? method} />
            <Row label="You add" value={`₦${amountMajor.toLocaleString('en-NG')}.00`} />
            <Row
              label="Fee"
              value={
                feeLoading
                  ? 'Calculating…'
                  : feeQuote
                    ? formatMinorAsNaira(feeQuote.feeMinor)
                    : '₦0.00'
              }
            />
            <Row
              label="Wallet credit"
              value={
                feeQuote
                  ? formatMinorAsNaira(feeQuote.netMinor)
                  : `₦${amountMajor.toLocaleString('en-NG')}.00`
              }
              bold
            />
            <Row label="Currency" value="NGN" />
            {feeQuote ? (
              <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space.sm }}>
                {feeQuote.disclosure}
              </Text>
            ) : null}
          </View>
          {error ? (
            <Text variant="caption" color={colors.error}>
              {error}
            </Text>
          ) : null}
          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: space.md }} />
          ) : (
            <Button label="Confirm & credit" fullWidth onPress={onConfirm} />
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

      {step === 'done' ? (
        <SuccessExperience
          badge="Funded"
          title="Money added"
          subtitle="Your NGN wallet is ready to convert, send, or pay bills."
          amount={
            credited
              ? formatMoney(credited, 'NGN')
              : `₦${amountMajor.toLocaleString('en-NG')}.00`
          }
          amountCurrency="NGN"
          meta={[
            {
              label: 'Method',
              value: METHODS.find((m) => m.id === method)?.label ?? method,
            },
            { label: 'Currency', value: 'NGN' },
          ]}
          primaryLabel="Back to Home"
          onPrimary={() => router.replace('/(tabs)')}
          secondaryLabel="Send money"
          onSecondary={() => router.replace('/(tabs)/send')}
        />
      ) : null}

      <BottomSheet
        visible={methodSheet}
        onClose={() => setMethodSheet(false)}
        title="Funding method"
      >
        {METHODS.map((m) => (
          <Pressable
            key={m.id}
            style={styles.methodRow}
            onPress={() => {
              setMethod(m.id);
              setMethodSheet(false);
            }}
          >
            <Text variant="bodyMedium">{m.label}</Text>
          </Pressable>
        ))}
      </BottomSheet>
    </Screen>
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
  body: { flex: 1, gap: space.sm, paddingBottom: space.lg },
  sub: { marginBottom: space.sm },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  methodChip: { alignSelf: 'flex-start', marginBottom: space.xs },
  currencyLabel: { textAlign: 'center' },
  amount: { textAlign: 'center', marginBottom: space.md },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: space.md,
  },
  key: {
    width: '33.33%',
    height: 64,
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
