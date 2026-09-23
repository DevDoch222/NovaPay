import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
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
  AirtimeOperator,
  AirtimeResult,
  Biller,
  BillPayResult,
} from '@/lib/bills-receive-api';
import { formatMoney, minorToMajor } from '@/lib/money';
import { ApiError } from '@/lib/api';
import { colors, radii, space } from '@/theme';

type Mode = 'bills' | 'airtime';
type Step = 'pick' | 'form' | 'auth' | 'done';

const accessoryId = Platform.OS === 'ios' ? FORM_ACCESSORY_ID : undefined;

export default function BillsScreen() {
  const { user, unlocked, authFetch } = useAuth();
  const { walletFor, refresh } = useWallets();
  const authFetchRef = useRef(authFetch);
  authFetchRef.current = authFetch;

  const [mode, setMode] = useState<Mode>('bills');
  const [step, setStep] = useState<Step>('pick');
  const [billers, setBillers] = useState<Biller[]>([]);
  const [operators, setOperators] = useState<AirtimeOperator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [biller, setBiller] = useState<Biller | null>(null);
  const [operator, setOperator] = useState<AirtimeOperator | null>(null);
  const [customerRef, setCustomerRef] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [resultLabel, setResultLabel] = useState('');
  const [resultMinor, setResultMinor] = useState<string | null>(null);
  const [resultCurrency, setResultCurrency] = useState('NGN');

  const ngn = walletFor('NGN');

  useEffect(() => {
    if (!user || !unlocked) {
      router.replace('/');
      return;
    }
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      authFetchRef.current<Biller[]>('/v1/bills/catalog?country=NG'),
      authFetchRef.current<AirtimeOperator[]>('/v1/airtime/operators?country=NG'),
    ])
      .then(([b, o]) => {
        if (cancelled) return;
        setBillers(b);
        setOperators(o);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : 'Failed to load catalog');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, unlocked]);

  function goForm() {
    setError(null);
    if (mode === 'bills' && !biller) {
      setError('Choose a biller');
      return;
    }
    if (mode === 'airtime' && !operator) {
      setError('Choose a network');
      return;
    }
    setStep('form');
  }

  function validateForm(): boolean {
    const amountMajor = Number(amount);
    if (!Number.isFinite(amountMajor) || amountMajor < 1) {
      setError('Enter at least ₦1');
      return false;
    }
    if (minorToMajor(ngn?.balanceMinor ?? '0') < amountMajor) {
      setError('Insufficient NGN balance');
      return false;
    }
    if (mode === 'bills') {
      if (customerRef.trim().length < 3) {
        setError('Enter meter / smartcard / account number');
        return false;
      }
    } else {
      const p = phone.trim();
      if (!/^\+[1-9]\d{7,14}$/.test(p)) {
        setError('Phone must be E.164, e.g. +2348012345678');
        return false;
      }
    }
    setError(null);
    return true;
  }

  async function executePay() {
    setBusy(true);
    setError(null);
    try {
      const amountMajor = Math.floor(Number(amount));
      const key = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      if (mode === 'bills' && biller) {
        const result = await authFetchRef.current<BillPayResult>('/v1/bills/pay', {
          method: 'POST',
          body: {
            billerId: biller.id,
            customerRef: customerRef.trim(),
            amountMajor,
            idempotencyKey: key,
          },
        });
        setResultLabel(result.biller.name);
        setResultMinor(result.amountMinor);
        setResultCurrency(result.currency);
      } else if (mode === 'airtime' && operator) {
        const result = await authFetchRef.current<AirtimeResult>(
          '/v1/airtime/topup',
          {
            method: 'POST',
            body: {
              operatorId: operator.id,
              phone: phone.trim(),
              amountMajor,
              idempotencyKey: key,
            },
          },
        );
        setResultLabel(result.operator.name);
        setResultMinor(result.amountMinor);
        setResultCurrency(result.currency);
      }
      await refresh();
      setStep('done');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Payment failed');
      setStep('form');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']} style={{ paddingHorizontal: 0 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text variant="bodyMedium" color={colors.accent}>
            Close
          </Text>
        </Pressable>
        <Text variant="h3">Pay</Text>
        <View style={{ width: 48 }} />
      </View>

      {step === 'pick' || step === 'form' ? (
        <View style={styles.tabs}>
          {(['bills', 'airtime'] as Mode[]).map((m) => (
            <Pressable
              key={m}
              style={[styles.tab, mode === m && styles.tabOn]}
              onPress={() => {
                setMode(m);
                setStep('pick');
                setError(null);
              }}
            >
              <Text
                variant="bodyMedium"
                color={mode === m ? colors.primary : colors.textMuted}
              >
                {m === 'bills' ? 'Bills' : 'Airtime'}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />
      ) : null}

      {step === 'pick' && !loading ? (
        <ScrollView contentContainerStyle={styles.body}>
          <Text variant="secondary">
            Charged from your NGN wallet · sandbox catalog
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            Available {ngn ? formatMoney(ngn.balanceMinor, 'NGN') : '₦0.00'}
          </Text>
          {error ? (
            <Text variant="caption" color={colors.error}>
              {error}
            </Text>
          ) : null}

          {mode === 'bills'
            ? billers.map((b) => (
                <Pressable
                  key={b.id}
                  style={[styles.row, biller?.id === b.id && styles.rowOn]}
                  onPress={() => setBiller(b)}
                >
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium">{b.name}</Text>
                    <Text variant="caption" color={colors.textMuted}>
                      {b.category} · {b.currency}
                    </Text>
                  </View>
                  {biller?.id === b.id ? (
                    <StatusPill label="Selected" tone="success" />
                  ) : null}
                </Pressable>
              ))
            : operators.map((o) => (
                <Pressable
                  key={o.id}
                  style={[styles.row, operator?.id === o.id && styles.rowOn]}
                  onPress={() => setOperator(o)}
                >
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium">{o.name}</Text>
                    <Text variant="caption" color={colors.textMuted}>
                      {o.currency}
                    </Text>
                  </View>
                  {operator?.id === o.id ? (
                    <StatusPill label="Selected" tone="success" />
                  ) : null}
                </Pressable>
              ))}

          <Button label="Continue" fullWidth onPress={goForm} />
        </ScrollView>
      ) : null}

      {step === 'form' ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <Text variant="h3">
              {mode === 'bills' ? biller?.name : operator?.name}
            </Text>
            {mode === 'bills' ? (
              <TextField
                label="Customer / meter / smartcard no."
                value={customerRef}
                onChangeText={setCustomerRef}
                placeholder="1234567890"
                inputAccessoryViewID={accessoryId}
              />
            ) : (
              <TextField
                label="Phone (E.164)"
                value={phone}
                onChangeText={setPhone}
                placeholder="+2348012345678"
                keyboardType="phone-pad"
                inputAccessoryViewID={accessoryId}
              />
            )}
            <TextField
              label="Amount (NGN)"
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^\d]/g, '').slice(0, 9))}
              placeholder={mode === 'bills' ? '9000' : '500'}
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
                if (validateForm()) setStep('auth');
              }}
            />
            <Button
              label="Back"
              variant="ghost"
              fullWidth
              onPress={() => setStep('pick')}
            />
          </ScrollView>
          <KeyboardDoneAccessory nativeID={FORM_ACCESSORY_ID} />
        </KeyboardAvoidingView>
      ) : null}

      {step === 'auth' ? (
        <View style={styles.body}>
          <ConfirmSecureAction
            title={mode === 'bills' ? 'Confirm bill payment' : 'Confirm airtime'}
            subtitle={`Authorize ₦${Number(amount).toLocaleString('en-NG')} with PIN or biometrics.`}
            busy={busy}
            onCancel={() => setStep('form')}
            onSuccess={executePay}
          />
        </View>
      ) : null}

      {step === 'done' ? (
        <SuccessExperience
          badge="Paid"
          title="Payment successful"
          subtitle={resultLabel}
          amount={
            resultMinor
              ? formatMoney(resultMinor, resultCurrency)
              : `₦${Number(amount).toLocaleString('en-NG')}.00`
          }
          amountCurrency={resultCurrency}
          meta={[
            { label: 'Type', value: mode === 'bills' ? 'Bill' : 'Airtime' },
            {
              label: mode === 'bills' ? 'Reference' : 'Phone',
              value: mode === 'bills' ? customerRef : phone,
            },
          ]}
          primaryLabel="Done"
          onPrimary={() => router.replace('/(tabs)')}
          secondaryLabel="Pay again"
          onSecondary={() => {
            setStep('pick');
            setAmount('');
            setCustomerRef('');
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  rowOn: {
    backgroundColor: colors.accentSoft,
    marginHorizontal: -space.md,
    paddingHorizontal: space.md,
    borderRadius: radii.md,
    borderBottomWidth: 0,
  },
});
