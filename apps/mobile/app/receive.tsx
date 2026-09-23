import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
  TextInput,
  Share,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  Screen,
  Text,
  Button,
  StatusPill,
  BottomSheet,
  KeyboardDoneAccessory,
  FORM_ACCESSORY_ID,
} from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { useWallets } from '@/wallets/WalletsContext';
import type {
  InboundCreditResult,
  VirtualAccount,
} from '@/lib/bills-receive-api';
import { formatMoney } from '@/lib/money';
import { ApiError, unwrapItems, type PaginatedResult } from '@/lib/api';
import { colors, radii, space } from '@/theme';

const accessoryId = Platform.OS === 'ios' ? FORM_ACCESSORY_ID : undefined;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text variant="caption" color={colors.textSecondary}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={styles.detailValue}>
        {value}
      </Text>
    </View>
  );
}

export default function ReceiveScreen() {
  const { user, unlocked, authFetch } = useAuth();
  const { walletFor, refresh } = useWallets();
  const authFetchRef = useRef(authFetch);
  authFetchRef.current = authFetch;

  const [accounts, setAccounts] = useState<VirtualAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<VirtualAccount | null>(null);
  const [inboundSheet, setInboundSheet] = useState(false);
  const [inboundAmount, setInboundAmount] = useState('250');

  const usd = walletFor('USD');
  const eur = walletFor('EUR');

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const body = await authFetchRef.current<
        PaginatedResult<VirtualAccount> | VirtualAccount[]
      >('/v1/accounts/virtual');
      setAccounts(unwrapItems(body));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load accounts');
    }
  }, [user]);

  useEffect(() => {
    if (!user || !unlocked) {
      router.replace('/');
      return;
    }
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [user, unlocked, load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function create(currency: 'USD' | 'EUR') {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const va = await authFetchRef.current<VirtualAccount>(
        '/v1/accounts/virtual',
        { method: 'POST', body: { currency } },
      );
      setAccounts((prev) => {
        const others = prev.filter((a) => a.currency !== currency);
        return [va, ...others];
      });
      setSelected(va);
      setNotice(`${currency} receive account ready`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create account');
    } finally {
      setBusy(false);
    }
  }

  async function simulateInbound() {
    if (!selected) return;
    const amountMajor = Number(inboundAmount);
    if (!Number.isFinite(amountMajor) || amountMajor < 1) {
      setError('Enter at least 1');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await authFetchRef.current<InboundCreditResult>(
        `/v1/accounts/virtual/${selected.id}/simulate-inbound`,
        {
          method: 'POST',
          body: {
            amountMajor: Math.floor(amountMajor),
            currency: selected.currency,
            externalReference: `inbound-${Date.now()}`,
            senderName: 'Acme Client LLC',
          },
        },
      );
      await refresh();
      setInboundSheet(false);
      setNotice(
        `Received ${formatMoney(result.amountMinor, result.currency)} from Acme Client LLC`,
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Inbound failed');
    } finally {
      setBusy(false);
    }
  }

  async function shareDetails(va: VirtualAccount) {
    const lines = [
      `NovaPay ${va.currency} receive`,
      `Name: ${va.accountName}`,
      va.iban
        ? `IBAN: ${va.iban}`
        : `Account: ${va.accountNumber}`,
      va.routingNumber ? `Routing: ${va.routingNumber}` : null,
      va.bic ? `BIC: ${va.bic}` : null,
      `Bank: ${va.bankName}`,
    ].filter(Boolean);
    await Share.share({ message: lines.join('\n') });
  }

  const hasUsd = accounts.some((a) => a.currency === 'USD');
  const hasEur = accounts.some((a) => a.currency === 'EUR');

  return (
    <Screen edges={['top', 'bottom']} style={{ paddingHorizontal: 0 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text variant="bodyMedium" color={colors.accent}>
            Close
          </Text>
        </Pressable>
        <Text variant="h3">Receive</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.accent}
          />
        }
      >
        <Text variant="secondary">
          Share bank details so clients can pay you in USD or EUR. Credits land
          in your matching wallet.
        </Text>
        <Text variant="caption" color={colors.textMuted}>
          USD {usd ? formatMoney(usd.balanceMinor, 'USD') : '$0.00'} · EUR{' '}
          {eur ? formatMoney(eur.balanceMinor, 'EUR') : '€0.00'}
        </Text>

        {notice ? (
          <Text variant="caption" color={colors.accent}>
            {notice}
          </Text>
        ) : null}
        {error ? (
          <Text variant="caption" color={colors.error}>
            {error}
          </Text>
        ) : null}

        {loading ? (
          <ActivityIndicator color={colors.accent} />
        ) : null}

        <View style={styles.createRow}>
          {!hasUsd ? (
            <Button
              label="Create USD account"
              fullWidth
              disabled={busy}
              onPress={() => void create('USD')}
            />
          ) : null}
          {!hasEur ? (
            <Button
              label="Create EUR account"
              variant={hasUsd ? 'primary' : 'secondary'}
              fullWidth
              disabled={busy}
              onPress={() => void create('EUR')}
            />
          ) : null}
        </View>

        {!loading && accounts.length === 0 ? (
          <Text variant="secondary">
            No receive accounts yet. Create one to get ACH or SEPA details.
          </Text>
        ) : null}

        {accounts.map((va) => (
          <Pressable
            key={va.id}
            style={styles.account}
            onPress={() => {
              setSelected(va);
              setNotice(null);
              setError(null);
            }}
          >
            <View style={styles.accountHead}>
              <Text variant="h3">{va.currency}</Text>
              <StatusPill
                label={va.status}
                tone={va.status === 'active' ? 'success' : 'neutral'}
              />
            </View>
            <Text variant="bodyMedium">
              {va.iban || va.accountNumber}
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              {va.bankName} · tap for full details
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <BottomSheet
        visible={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={`${selected?.currency ?? ''} receive`}
      >
        {selected ? (
          <View style={styles.sheet}>
            <Text variant="secondary">{selected.instructions}</Text>
            <Row label="Account name" value={selected.accountName} />
            {selected.iban ? (
              <Row label="IBAN" value={selected.iban} />
            ) : (
              <Row label="Account number" value={selected.accountNumber} />
            )}
            {selected.routingNumber ? (
              <Row label="Routing" value={selected.routingNumber} />
            ) : null}
            {selected.bic ? <Row label="BIC" value={selected.bic} /> : null}
            <Row label="Bank" value={selected.bankName} />

            <Button
              label="Share details"
              variant="secondary"
              fullWidth
              onPress={() => void shareDetails(selected)}
            />
            <Button
              label="Simulate inbound credit"
              fullWidth
              onPress={() => {
                setInboundAmount('250');
                setInboundSheet(true);
              }}
            />
            <Button
              label="Close"
              variant="ghost"
              fullWidth
              onPress={() => setSelected(null)}
            />
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet
        visible={inboundSheet}
        onClose={() => setInboundSheet(false)}
        title="Simulate inbound"
      >
        <View style={styles.sheet}>
          <Text variant="secondary">
            Sandbox only — credits {selected?.currency} as if a client paid you.
          </Text>
          <Text variant="caption" color={colors.textSecondary}>
            Amount ({selected?.currency})
          </Text>
          <TextInput
            value={inboundAmount}
            onChangeText={(t) =>
              setInboundAmount(t.replace(/[^\d]/g, '').slice(0, 9))
            }
            keyboardType="number-pad"
            style={styles.input}
            inputAccessoryViewID={accessoryId}
          />
          {error ? (
            <Text variant="caption" color={colors.error}>
              {error}
            </Text>
          ) : null}
          <Button
            label="Credit wallet"
            fullWidth
            loading={busy}
            onPress={() => void simulateInbound()}
          />
          <KeyboardDoneAccessory nativeID={FORM_ACCESSORY_ID} />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
    marginBottom: space.lg,
    paddingHorizontal: space.md,
  },
  body: {
    paddingHorizontal: space.md,
    paddingBottom: space.xxl,
    gap: space.sm,
  },
  createRow: { gap: space.sm, marginVertical: space.sm },
  account: {
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    gap: space.xxs,
  },
  accountHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheet: { gap: space.sm, paddingBottom: space.md },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  detailValue: { flex: 1, textAlign: 'right' },
  input: {
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    color: colors.text,
    backgroundColor: colors.surface,
  },
});
