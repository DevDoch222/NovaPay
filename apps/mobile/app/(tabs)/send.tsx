import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Screen, Text, Button, StatusPill, Card } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { type Beneficiary } from '@/lib/fx-send-api';
import { ApiError, unwrapItems, type PaginatedResult } from '@/lib/api';
import { colors, radii, space } from '@/theme';

export default function SendScreen() {
  const { accessToken, user, authFetch } = useAuth();
  const [items, setItems] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authFetchRef = useRef(authFetch);
  authFetchRef.current = authFetch;

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      const body = await authFetchRef.current<
        PaginatedResult<Beneficiary> | Beneficiary[]
      >('/v1/beneficiaries');
      const rows = unwrapItems(body);
      setItems(rows);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load recipients');
    }
  }, [accessToken]);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const needsKyc = user?.kycTier === 'tier_0';

  return (
    <Screen scroll={false} style={{ paddingHorizontal: 0 }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <Text variant="h1" style={styles.title}>
          Send
        </Text>
        <Text variant="secondary" style={styles.sub}>
          Bank or mobile money — fees and limits shown before you confirm.
        </Text>

        {needsKyc ? (
          <Card style={styles.banner}>
            <StatusPill label="Tier 0" tone="warning" />
            <Text variant="bodyMedium">Verification required to send</Text>
            <Text variant="secondary">
              Complete KYC to unlock payouts. Tier 0 single payout limit is ₦0.
            </Text>
            <Button
              label="Increase my limits"
              style={styles.cta}
              onPress={() => router.push('/(auth)/kyc')}
            />
          </Card>
        ) : null}

        <View style={styles.sectionHead}>
          <Text variant="h3">Recipients</Text>
          <Pressable onPress={() => router.push('/add-beneficiary')}>
            <Text variant="caption" color={colors.accent}>
              Add new
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: space.lg }} />
        ) : null}

        {error ? (
          <Text variant="caption" color={colors.error}>
            {error}
          </Text>
        ) : null}

        {!loading && items.length === 0 ? (
          <Card>
            <Text variant="bodyMedium">No recipients yet</Text>
            <Text variant="secondary" style={styles.hint}>
              Add a Nigerian bank account or mobile money wallet to send NGN.
            </Text>
            <Button
              label="Add beneficiary"
              style={styles.cta}
              onPress={() => router.push('/add-beneficiary')}
            />
          </Card>
        ) : (
          <View style={styles.list}>
            {items.map((b) => (
              <Pressable
                key={b.id}
                style={styles.row}
                onPress={() =>
                  router.push({
                    pathname: '/send-money',
                    params: { beneficiaryId: b.id },
                  })
                }
              >
                <View style={styles.avatar}>
                  <Text variant="bodyMedium" color={colors.primary}>
                    {b.accountName.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium">{b.label || b.accountName}</Text>
                  <Text variant="caption">
                    {b.type === 'bank'
                      ? `${b.bankName ?? 'Bank'} · ${maskAcct(b.accountNumber)}`
                      : `${(b.provider ?? 'momo').toUpperCase()} · ${maskAcct(b.accountNumber)}`}
                  </Text>
                </View>
                <Text variant="h3" color={colors.accent}>
                  →
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function maskAcct(n: string) {
  if (n.length < 4) return n;
  return `•••• ${n.slice(-4)}`;
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: space.md, paddingBottom: space.xxl },
  title: { marginTop: space.sm },
  sub: { marginTop: space.xs, marginBottom: space.lg },
  banner: { gap: space.sm, marginBottom: space.lg },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  hint: { marginTop: space.xs },
  cta: { marginTop: space.sm },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
