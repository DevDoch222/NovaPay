import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  Screen,
  Text,
  Button,
  TextField,
  StatusPill,
  SuccessExperience,
  KeyboardDoneAccessory,
  FORM_ACCESSORY_ID,
} from '@/components/ui';
import { ConfirmSecureAction } from '@/components/auth/ConfirmSecureAction';
import { useAuth } from '@/auth/AuthContext';
import { useWallets } from '@/wallets/WalletsContext';
import type {
  StableAsset,
  StableBalance,
  StableConvertResult,
  StableDepositResult,
} from '@/lib/stablecoins-api';
import { formatMoney, minorToMajor } from '@/lib/money';
import { ApiError, unwrapItems, type PaginatedResult } from '@/lib/api';
import { colors, space } from '@/theme';

type Mode = 'deposit' | 'toUsd' | 'fromUsd';
type Step = 'form' | 'auth' | 'done';

const accessoryId = Platform.OS === 'ios' ? FORM_ACCESSORY_ID : undefined;
const ASSETS: StableAsset[] = ['USDC', 'USDT'];

export default function StablesScreen() {
  const { user, unlocked, authFetch } = useAuth();
  const { walletFor, refresh } = useWallets();
  const authFetchRef = useRef(authFetch);
  authFetchRef.current = authFetch;

  const [mode, setMode] = useState<Mode>('deposit');
  const [step, setStep] = useState<Step>('form');
  const [asset, setAsset] = useState<StableAsset>('USDC');
  const [amount, setAmount] = useState('50');
  const [balances, setBalances] = useState<StableBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMinor, setDoneMinor] = useState<string | null>(null);
  const [doneLabel, setDoneLabel] = useState('');

  const usd = walletFor('USD');

  const loadBalances = useCallback(async () => {
    if (!user) return;
    try {
      const body = await authFetchRef.current<
        PaginatedResult<StableBalance> | StableBalance[]
      >('/v1/stablecoins/balances');
      setBalances(unwrapItems(body));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load balances');
    }
  }, [user]);

  useEffect(() => {
    if (!user || !unlocked) {
      router.replace('/');
      return;
    }
    setLoading(true);
    void loadBalances().finally(() => setLoading(false));
  }, [user, unlocked, loadBalances]);

  useFocusEffect(
    useCallback(() => {
      void loadBalances();
    }, [loadBalances]),
  );

  function balanceFor(ccy: string) {
    return balances.find((b) => b.currency === ccy)?.balanceMinor ?? '0';
  }

  function validate(): boolean {
    const amountMajor = Number(amount);
    if (!Number.isFinite(amountMajor) || amountMajor < 1) {
      setError('Enter at least 1');
      return false;
    }
    if (mode === 'toUsd') {
      if (minorToMajor(balanceFor(asset)) < amountMajor) {
        setError(`Insufficient ${asset}`);
        return false;
      }
    }
    if (mode === 'fromUsd') {
      if (minorToMajor(usd?.balanceMinor ?? '0') < amountMajor) {
        setError('Insufficient USD');
        return false;
      }
    }
    setError(null);
    return true;
  }

  async function execute() {
    setBusy(true);
    setError(null);
    try {
      const amountMajor = Math.floor(Number(amount));
      const key = `stable-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      if (mode === 'deposit') {
        const result = await authFetchRef.current<StableDepositResult>(
          '/v1/stablecoins/deposit',
          {
            method: 'POST',
            body: { currency: asset, amountMajor, idempotencyKey: key },
          },
        );
        setDoneMinor(result.amountMinor);
        setDoneLabel(`${result.currency} deposited`);
      } else if (mode === 'toUsd') {
        const result = await authFetchRef.current<StableConvertResult>(
          '/v1/stablecoins/convert',
          {
            method: 'POST',
            body: {
              sourceCurrency: asset,
              destCurrency: 'USD',
              sourceAmountMajor: amountMajor,
              idempotencyKey: key,
            },
          },
        );
        setDoneMinor(result.amountMinor);
        setDoneLabel(`${result.sourceCurrency} → USD`);
      } else {
        const result = await authFetchRef.current<StableConvertResult>(
          '/v1/stablecoins/convert',
          {
            method: 'POST',
            body: {
              sourceCurrency: 'USD',
              destCurrency: asset,
              sourceAmountMajor: amountMajor,
              idempotencyKey: key,
            },
          },
        );
        setDoneMinor(result.amountMinor);
        setDoneLabel(`USD → ${result.destCurrency}`);
      }

      await refresh();
      await loadBalances();
      setStep('done');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Request failed');
      setStep('form');
    } finally {
      setBusy(false);
    }
  }

  const modes: { id: Mode; label: string }[] = [
    { id: 'deposit', label: 'Deposit' },
    { id: 'toUsd', label: 'To USD' },
    { id: 'fromUsd', label: 'From USD' },
  ];

  return (
    <Screen edges={['top', 'bottom']} style={{ paddingHorizontal: 0 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text variant="bodyMedium" color={colors.accent}>
            Close
          </Text>
        </Pressable>
        <Text variant="h3">Stablecoins</Text>
        <View style={{ width: 48 }} />
      </View>

      {step !== 'auth' && step !== 'done' ? (
        <View style={styles.tabs}>
          {modes.map((m) => (
            <Pressable
              key={m.id}
              style={[styles.tab, mode === m.id && styles.tabOn]}
              onPress={() => {
                setMode(m.id);
                setError(null);
                setStep('form');
              }}
            >
              <Text
                variant="caption"
                color={mode === m.id ? colors.primary : colors.textMuted}
              >
                {m.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />
      ) : null}

      {step === 'form' && !loading ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  await loadBalances();
                  setRefreshing(false);
                }}
                tintColor={colors.accent}
              />
            }
          >
            <Text variant="secondary">
              Sandbox custody · 1 USDC / USDT = 1 USD when you convert
            </Text>

            <View style={styles.balRow}>
              {ASSETS.map((a) => (
                <View key={a} style={styles.balItem}>
                  <Text variant="caption" color={colors.textMuted}>
                    {a}
                  </Text>
                  <Text variant="bodyMedium">
                    {formatMoney(balanceFor(a), a)}
                  </Text>
                </View>
              ))}
              <View style={styles.balItem}>
                <Text variant="caption" color={colors.textMuted}>
                  USD
                </Text>
                <Text variant="bodyMedium">
                  {usd ? formatMoney(usd.balanceMinor, 'USD') : '$0.00'}
                </Text>
              </View>
            </View>

            <Text variant="caption" color={colors.textSecondary}>
              Asset
            </Text>
            <View style={styles.assetRow}>
              {ASSETS.map((a) => (
                <Pressable
                  key={a}
                  style={[styles.assetChip, asset === a && styles.assetOn]}
                  onPress={() => setAsset(a)}
                >
                  <Text
                    variant="bodyMedium"
                    color={asset === a ? colors.primary : colors.textSecondary}
                  >
                    {a}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextField
              label={
                mode === 'deposit'
                  ? `Amount (${asset})`
                  : mode === 'toUsd'
                    ? `Amount (${asset} → USD)`
                    : `Amount (USD → ${asset})`
              }
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^\d]/g, '').slice(0, 9))}
              keyboardType="number-pad"
              inputAccessoryViewID={accessoryId}
            />

            {error ? (
              <Text variant="caption" color={colors.error}>
                {error}
              </Text>
            ) : null}

            <Button
              label="Continue"
              fullWidth
              onPress={() => {
                if (validate()) setStep('auth');
              }}
            />
          </ScrollView>
          <KeyboardDoneAccessory nativeID={FORM_ACCESSORY_ID} />
        </KeyboardAvoidingView>
      ) : null}

      {step === 'auth' ? (
        <View style={styles.body}>
          <ConfirmSecureAction
            title="Authorize"
            subtitle={`Confirm ${amount} ${mode === 'fromUsd' ? 'USD' : asset} with PIN or biometrics.`}
            busy={busy}
            onCancel={() => setStep('form')}
            onSuccess={execute}
          />
        </View>
      ) : null}

      {step === 'done' ? (
        <SuccessExperience
          badge="Complete"
          title={doneLabel}
          subtitle="Balances updated across your USD and stablecoin wallets."
          amount={
            doneMinor
              ? formatMoney(
                  doneMinor,
                  mode === 'toUsd' ? 'USD' : asset,
                )
              : amount
          }
          amountCurrency={mode === 'toUsd' ? 'USD' : asset}
          meta={[
            {
              label: 'Action',
              value:
                mode === 'deposit'
                  ? 'Deposit'
                  : mode === 'toUsd'
                    ? `${asset} → USD`
                    : `USD → ${asset}`,
            },
            { label: 'Rate', value: '1.00 (sandbox)' },
          ]}
          primaryLabel="Done"
          onPrimary={() => router.replace('/(tabs)')}
          secondaryLabel="Another transfer"
          onSecondary={() => {
            setStep('form');
            setDoneMinor(null);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
    marginBottom: space.md,
    paddingHorizontal: space.md,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: space.md,
    marginBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  tabOn: {
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  body: {
    paddingHorizontal: space.md,
    paddingBottom: space.xxl,
    gap: space.sm,
  },
  balRow: {
    flexDirection: 'row',
    gap: space.md,
    marginVertical: space.sm,
  },
  balItem: { flex: 1, gap: 2 },
  assetRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.sm },
  assetChip: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  assetOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
});
