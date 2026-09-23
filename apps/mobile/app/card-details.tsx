import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Platform,
  RefreshControl,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Screen,
  Text,
  Button,
  StatusPill,
  BottomSheet,
  KeyboardDoneAccessory,
  FORM_ACCESSORY_ID,
} from '@/components/ui';
import { CardFace, CardDesignPicker } from '@/components/cards/CardFace';
import { ConfirmSecureAction } from '@/components/auth/ConfirmSecureAction';
import { useAuth } from '@/auth/AuthContext';
import { useWallets } from '@/wallets/WalletsContext';
import type {
  CardAuthorizeResult,
  CardSettleResult,
  NovaCard,
} from '@/lib/cards-api';
import { formatFulfillmentStatus } from '@/lib/cards-api';
import type { CardDesignId } from '@/lib/card-designs';
import { getCardDesignId, setCardDesignId } from '@/lib/card-design-store';
import { formatMoney, minorToMajor } from '@/lib/money';
import { ApiError, unwrapItems, type PaginatedResult } from '@/lib/api';
import { colors, radii, space } from '@/theme';

type SecureIntent =
  | { kind: 'freeze' }
  | { kind: 'close' }
  | { kind: 'spend'; amountMajor: number; merchant: string }
  | null;

const accessoryId = Platform.OS === 'ios' ? FORM_ACCESSORY_ID : undefined;

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="caption" color={colors.textSecondary}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={styles.rowValue}>
        {value}
      </Text>
    </View>
  );
}

export default function CardDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, unlocked, authFetch } = useAuth();
  const { walletFor, refresh: refreshWallets } = useWallets();
  const authFetchRef = useRef(authFetch);
  authFetchRef.current = authFetch;

  const [card, setCard] = useState<NovaCard | null>(null);
  const [designId, setDesignId] = useState<CardDesignId>('harbor');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [spendSheet, setSpendSheet] = useState(false);
  const [spendAmount, setSpendAmount] = useState('10');
  const [merchant, setMerchant] = useState('Notion');
  const [secure, setSecure] = useState<SecureIntent>(null);
  const [busy, setBusy] = useState(false);

  const usd = walletFor('USD');

  const load = useCallback(async () => {
    if (!id || !user) return;
    setError(null);
    try {
      const [body, savedDesign] = await Promise.all([
        authFetchRef.current<PaginatedResult<NovaCard> | NovaCard[]>('/v1/cards'),
        getCardDesignId(id),
      ]);
      const rows = unwrapItems(body);
      const found = rows.find((c) => c.id === id) ?? null;
      setCard(found);
      if (savedDesign) setDesignId(savedDesign);
      if (!found) setError('Card not found');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load card');
    }
  }, [id, user]);

  useEffect(() => {
    if (!user || !unlocked) {
      router.replace('/');
      return;
    }
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [user, unlocked, load]);

  async function runSecure() {
    if (!secure || !card) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      if (secure.kind === 'freeze') {
        const updated = await authFetchRef.current<NovaCard>(
          `/v1/cards/${card.id}/freeze`,
          { method: 'POST' },
        );
        setCard(updated);
        setNotice('Card frozen');
      } else if (secure.kind === 'close') {
        const updated = await authFetchRef.current<NovaCard>(
          `/v1/cards/${card.id}/close`,
          { method: 'POST' },
        );
        setCard(updated);
        setNotice('Card closed');
      } else if (secure.kind === 'spend') {
        const auth = await authFetchRef.current<CardAuthorizeResult>(
          `/v1/cards/${card.id}/authorize`,
          {
            method: 'POST',
            body: {
              amountMajor: secure.amountMajor,
              merchant: secure.merchant,
              idempotencyKey: `spend-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            },
          },
        );
        await authFetchRef.current<CardSettleResult>(
          `/v1/cards/authorizations/${auth.authorizationId}/settle`,
          { method: 'POST' },
        );
        await refreshWallets();
        setNotice(
          `Paid ${formatMoney(auth.amountMinor, 'USD')} at ${secure.merchant}`,
        );
        setSpendSheet(false);
      }
      setSecure(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Action failed');
      setSecure(null);
    } finally {
      setBusy(false);
    }
  }

  async function unfreeze() {
    if (!card) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await authFetchRef.current<NovaCard>(
        `/v1/cards/${card.id}/unfreeze`,
        { method: 'POST' },
      );
      setCard(updated);
      setNotice('Card unfrozen');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not unfreeze');
    } finally {
      setBusy(false);
    }
  }

  function startSpend() {
    if (!card) return;
    const amountMajor = Number(spendAmount);
    if (!Number.isFinite(amountMajor) || amountMajor < 1) {
      setError('Enter at least $1');
      return;
    }
    if (minorToMajor(usd?.balanceMinor ?? '0') < amountMajor) {
      setError('Insufficient USD balance — convert or fund first');
      return;
    }
    if (
      card.spendLimitMinor != null &&
      amountMajor > minorToMajor(card.spendLimitMinor)
    ) {
      setError('Amount exceeds this card spend limit');
      return;
    }
    setError(null);
    setSecure({
      kind: 'spend',
      amountMajor: Math.floor(amountMajor),
      merchant: merchant.trim() || 'Merchant',
    });
  }

  const createdLabel = card?.createdAt
    ? new Date(card.createdAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  return (
    <Screen edges={['top', 'bottom']} style={{ paddingHorizontal: 0 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text variant="bodyMedium" color={colors.accent}>
            Back
          </Text>
        </Pressable>
        <Text variant="h3">Card details</Text>
        <View style={{ width: 48 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />
      ) : null}

      {!loading && card ? (
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
          <CardFace card={card} designId={designId} />
          <CardDesignPicker
            value={designId}
            onChange={(next) => {
              setDesignId(next);
              void setCardDesignId(card.id, next);
            }}
          />

          {notice ? (
            <Text variant="caption" color={colors.accent}>
              {notice}
            </Text>
          ) : null}
          {error && !secure ? (
            <Text variant="caption" color={colors.error}>
              {error}
            </Text>
          ) : null}

          <View style={styles.details}>
            <Text variant="h3" style={styles.sectionTitle}>
              Details
            </Text>
            <DetailRow label="Status" value={card.status} />
            <DetailRow
              label="Type"
              value={card.form === 'physical' ? 'Physical' : 'Virtual'}
            />
            {card.form === 'physical' && card.fulfillmentStatus ? (
              <DetailRow
                label="Delivery"
                value={formatFulfillmentStatus(card.fulfillmentStatus)}
              />
            ) : null}
            <DetailRow label="Brand" value={card.brand.toUpperCase()} />
            <DetailRow label="Number" value={`•••• •••• •••• ${card.last4}`} />
            <DetailRow
              label="Expires"
              value={`${card.expMonth}/${card.expYear}`}
            />
            <DetailRow label="Currency" value={card.currency} />
            <DetailRow
              label="Nickname"
              value={card.label?.trim() || '—'}
            />
            <DetailRow
              label="Spend limit"
              value={
                card.spendLimitMinor
                  ? formatMoney(card.spendLimitMinor, 'USD')
                  : 'None'
              }
            />
            <DetailRow
              label="USD wallet"
              value={usd ? formatMoney(usd.balanceMinor, 'USD') : '$0.00'}
            />
            <DetailRow label="Issued" value={createdLabel} />
          </View>

          {card.form === 'physical' && card.shipping ? (
            <View style={styles.details}>
              <Text variant="h3" style={styles.sectionTitle}>
                Shipping
              </Text>
              <DetailRow
                label="Name"
                value={card.shipping.name?.trim() || '—'}
              />
              <DetailRow
                label="Address"
                value={card.shipping.line1?.trim() || '—'}
              />
              <DetailRow
                label="City"
                value={card.shipping.city?.trim() || '—'}
              />
              <DetailRow
                label="Country"
                value={card.shipping.country?.trim() || '—'}
              />
              <DetailRow
                label="Postal"
                value={card.shipping.postal?.trim() || '—'}
              />
            </View>
          ) : null}

          <View style={styles.actions}>
            {card.status === 'active' ? (
              <>
                <Button
                  label="Simulate purchase"
                  fullWidth
                  onPress={() => {
                    setSpendAmount('10');
                    setMerchant('Notion');
                    setError(null);
                    setSpendSheet(true);
                  }}
                />
                <Button
                  label="Freeze card"
                  variant="secondary"
                  fullWidth
                  disabled={busy}
                  onPress={() => setSecure({ kind: 'freeze' })}
                />
              </>
            ) : null}

            {card.status === 'frozen' ? (
              <Button
                label="Unfreeze"
                fullWidth
                disabled={busy}
                onPress={() => void unfreeze()}
              />
            ) : null}

            {card.status !== 'closed' ? (
              <Button
                label="Close card"
                variant="ghost"
                fullWidth
                disabled={busy}
                onPress={() => setSecure({ kind: 'close' })}
              />
            ) : (
              <StatusPill label="Closed" tone="neutral" />
            )}
          </View>
        </ScrollView>
      ) : null}

      {!loading && !card ? (
        <View style={styles.body}>
          <Text variant="secondary">{error ?? 'Card not found'}</Text>
          <Button label="Back to cards" fullWidth onPress={() => router.back()} />
        </View>
      ) : null}

      <BottomSheet
        visible={spendSheet && !secure}
        onClose={() => setSpendSheet(false)}
        title="Simulate purchase"
      >
        <View style={styles.sheet}>
          <Text variant="secondary">
            Sandbox: authorize hold, then settle against USD.
          </Text>
          <Text variant="caption" color={colors.textSecondary}>
            Merchant
          </Text>
          <TextInput
            value={merchant}
            onChangeText={setMerchant}
            placeholder="Merchant"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            inputAccessoryViewID={accessoryId}
          />
          <Text variant="caption" color={colors.textSecondary}>
            Amount (USD)
          </Text>
          <TextInput
            value={spendAmount}
            onChangeText={(t) => setSpendAmount(t.replace(/[^\d]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            placeholder="10"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            inputAccessoryViewID={accessoryId}
          />
          {error ? (
            <Text variant="caption" color={colors.error}>
              {error}
            </Text>
          ) : null}
          <Button label="Continue" fullWidth onPress={startSpend} />
          <KeyboardDoneAccessory nativeID={FORM_ACCESSORY_ID} />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={Boolean(secure)}
        onClose={() => {
          if (!busy) setSecure(null);
        }}
        title="Confirm"
      >
        {secure ? (
          <ConfirmSecureAction
            title={
              secure.kind === 'spend'
                ? 'Authorize spend'
                : secure.kind === 'freeze'
                  ? 'Freeze card'
                  : 'Close card'
            }
            subtitle={
              secure.kind === 'spend'
                ? `Confirm $${secure.amountMajor} at ${secure.merchant}`
                : 'Enter PIN or use biometrics to continue.'
            }
            busy={busy}
            onCancel={() => setSecure(null)}
            onSuccess={runSecure}
          />
        ) : null}
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
    gap: space.md,
  },
  details: {
    gap: space.sm,
    paddingTop: space.sm,
  },
  sectionTitle: { marginBottom: space.xs },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  rowValue: { flex: 1, textAlign: 'right' },
  actions: { gap: space.sm, marginTop: space.md },
  sheet: { gap: space.sm, paddingBottom: space.md },
  input: {
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: space.xs,
  },
});
