import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Screen,
  Text,
  MoneyText,
  Button,
  StatusPill,
  SuccessExperience,
} from '@/components/ui';
import { ConfirmSecureAction } from '@/components/auth/ConfirmSecureAction';
import { useAuth } from '@/auth/AuthContext';
import { useWallets } from '@/wallets/WalletsContext';
import { type Beneficiary } from '@/lib/fx-send-api';
import { formatMoney, minorToMajor } from '@/lib/money';
import { ApiError, unwrapItems, type PaginatedResult } from '@/lib/api';
import {
  formatMinorAsNaira,
  getFeeQuote,
  type FeeQuote,
} from '@/lib/fees-api';
import { colors, radii, space } from '@/theme';

type Step = 'amount' | 'confirm' | 'auth' | 'done';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'] as const;

export default function SendMoneyScreen() {
  const { beneficiaryId } = useLocalSearchParams<{ beneficiaryId: string }>();
  const { user, unlocked, authFetch, accessToken } = useAuth();
  const { walletFor, payout } = useWallets();
  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null);
  const [digits, setDigits] = useState('');
  const [step, setStep] = useState<Step>('amount');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultMinor, setResultMinor] = useState<string | null>(null);
  const [feeQuote, setFeeQuote] = useState<FeeQuote | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);

  const amountMajor = useMemo(() => Number(digits || '0') || 0, [digits]);
  const ngn = walletFor('NGN');
  const available = ngn?.balanceMinor ?? '0';

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
      type: 'payout',
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

  useEffect(() => {
    if (!user || !beneficiaryId) return;
    void authFetch<PaginatedResult<Beneficiary> | Beneficiary[]>('/v1/beneficiaries')
      .then((body) => {
        const rows = unwrapItems(body);
        const found = rows.find((b) => b.id === beneficiaryId) ?? null;
        setBeneficiary(found);
        if (!found) setError('Recipient not found');
      })
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : 'Failed to load recipient'),
      );
  }, [user?.id, beneficiaryId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  async function executePayout() {
    if (!beneficiary || !user) return;
    setLoading(true);
    setError(null);
    try {
      const result = await payout({
        beneficiaryId: beneficiary.id,
        amountMajor,
      });
      setResultMinor(result.amountMinor);
      setStep('done');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Payout failed');
      setStep('confirm');
    } finally {
      setLoading(false);
    }
  }

  function goToAuth() {
    if (!beneficiary || !user) return;
    if (user.kycTier === 'tier_0') {
      setError('Complete KYC to unlock sends');
      return;
    }
    if (amountMajor < 1) {
      setError('Enter at least ₦1');
      return;
    }
    if (minorToMajor(available) < amountMajor) {
      setError('Insufficient NGN balance');
      return;
    }
    setError(null);
    setStep('auth');
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text variant="bodyMedium" color={colors.accent}>
            Close
          </Text>
        </Pressable>
        <Text variant="h3">Send money</Text>
        <View style={{ width: 48 }} />
      </View>

      {!beneficiary && !error ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />
      ) : null}

      {beneficiary && step === 'amount' ? (
        <View style={styles.body}>
          <Text variant="caption" color={colors.textSecondary}>
            To
          </Text>
          <Text variant="h2">{beneficiary.label || beneficiary.accountName}</Text>
          <Text variant="secondary">
            {beneficiary.type === 'bank'
              ? `${beneficiary.bankName ?? 'Bank'} · ${beneficiary.accountNumber}`
              : `${(beneficiary.provider ?? 'momo').toUpperCase()} · ${beneficiary.accountNumber}`}
          </Text>
          <Text variant="caption" color={colors.textMuted} style={styles.avail}>
            Available {formatMoney(available, 'NGN')}
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

      {beneficiary && step === 'confirm' ? (
        <View style={styles.body}>
          <Text variant="h1">Confirm send</Text>
          <View style={styles.summary}>
            <Row label="To" value={beneficiary.label || beneficiary.accountName} />
            <Row
              label="Channel"
              value={
                beneficiary.type === 'bank'
                  ? beneficiary.bankName ?? 'Bank'
                  : (beneficiary.provider ?? 'momo').toUpperCase()
              }
            />
            <Row
              label="You send"
              value={`₦${amountMajor.toLocaleString('en-NG')}.00`}
              bold
            />
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
              label="Total debit"
              value={
                feeQuote
                  ? formatMinorAsNaira(feeQuote.netMinor)
                  : `₦${amountMajor.toLocaleString('en-NG')}.00`
              }
              bold
            />
            <Row label="Arrival" value="Sandbox · usually instant" />
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
          <Button label="Send now" fullWidth onPress={goToAuth} />
          <Button
            label="Back"
            variant="ghost"
            fullWidth
            onPress={() => setStep('amount')}
          />
        </View>
      ) : null}

      {step === 'auth' ? (
        <ConfirmSecureAction
          title="Authorize transfer"
          subtitle={`Confirm ₦${amountMajor.toLocaleString('en-NG')} with your PIN or biometrics.`}
          busy={loading}
          onCancel={() => {
            setError(null);
            setStep('confirm');
          }}
          onSuccess={executePayout}
        />
      ) : null}

      {step === 'done' ? (
        <SuccessExperience
          badge="Sent"
          title="Money on the way"
          subtitle="Wallet updated. Track status anytime in Activity."
          amount={
            resultMinor
              ? formatMoney(resultMinor, 'NGN')
              : `₦${amountMajor.toLocaleString('en-NG')}.00`
          }
          amountCurrency="NGN"
          meta={[
            {
              label: 'To',
              value: beneficiary?.label || beneficiary?.accountName || 'Recipient',
            },
            {
              label: 'Channel',
              value:
                beneficiary?.type === 'bank'
                  ? beneficiary.bankName ?? 'Bank'
                  : (beneficiary?.provider ?? 'momo').toUpperCase(),
            },
            { label: 'Fee', value: feeQuote ? formatMinorAsNaira(feeQuote.feeMinor) : '₦0.00' },
          ]}
          primaryLabel="Back to Send"
          onPrimary={() => router.replace('/(tabs)/send')}
          secondaryLabel="View activity"
          onSecondary={() => router.replace('/(tabs)/activity')}
        />
      ) : null}
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
      <Text variant={bold ? 'bodyMedium' : 'body'} style={{ flex: 1, textAlign: 'right' }}>
        {value}
      </Text>
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
  avail: { marginTop: space.md, textAlign: 'center' },
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
    gap: space.md,
  },
});
