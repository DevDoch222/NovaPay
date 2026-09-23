import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen, Text, Button } from '@/components/ui';
import { CardFace } from '@/components/cards/CardFace';
import { useAuth } from '@/auth/AuthContext';
import { useWallets } from '@/wallets/WalletsContext';
import type { NovaCard } from '@/lib/cards-api';
import { getAllCardDesignIds } from '@/lib/card-design-store';
import type { CardDesignId } from '@/lib/card-designs';
import { formatMoney } from '@/lib/money';
import { ApiError, unwrapItems, type PaginatedResult } from '@/lib/api';
import { colors, space } from '@/theme';

export default function CardsScreen() {
  const { accessToken, user, authFetch } = useAuth();
  const { walletFor } = useWallets();
  const authFetchRef = useRef(authFetch);
  authFetchRef.current = authFetch;

  const [cards, setCards] = useState<NovaCard[]>([]);
  const [designs, setDesigns] = useState<Record<string, CardDesignId>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usd = walletFor('USD');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      const [rowsBody, map] = await Promise.all([
        authFetchRef.current<PaginatedResult<NovaCard> | NovaCard[]>('/v1/cards'),
        getAllCardDesignIds(),
      ]);
      const rows = unwrapItems(rowsBody);
      setCards(rows);
      setDesigns(map);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load cards');
    }
  }, [accessToken]);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

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
            tintColor={colors.accent}
          />
        }
      >
        <Text variant="h1" style={styles.title}>
          Cards
        </Text>
        <Text variant="secondary" style={styles.sub}>
          Virtual and physical USD cards. Tap a card for details.
        </Text>
        <Text variant="caption" color={colors.textMuted} style={styles.bal}>
          USD wallet {usd ? formatMoney(usd.balanceMinor, 'USD') : '$0.00'}
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: space.lg }} />
        ) : null}

        {error ? (
          <Text variant="caption" color={colors.error} style={styles.err}>
            {error}
          </Text>
        ) : null}

        {!loading && cards.length === 0 ? (
          <View style={styles.empty}>
            <Text variant="h3">No cards yet</Text>
            <Text variant="secondary">
              Get a virtual card instantly or order a physical card to your
              address. Sandbox shows last4 only — never a full PAN.
            </Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {cards.map((card) => (
            <Pressable
              key={card.id}
              onPress={() =>
                router.push({
                  pathname: '/card-details',
                  params: { id: card.id },
                })
              }
            >
              <CardFace card={card} designId={designs[card.id]} />
            </Pressable>
          ))}
        </View>

        <Button
          label="Get a card"
          fullWidth
          style={styles.cta}
          onPress={() => router.push('/create-card')}
        />

        {user?.kycTier === 'tier_0' ? (
          <Text variant="caption" color={colors.textMuted} style={styles.hint}>
            Completing KYC raises send limits; cards work from USD balance in
            sandbox.
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: space.md,
    paddingBottom: space.xxl,
  },
  title: { marginTop: space.sm, marginBottom: space.xs },
  sub: { marginBottom: space.xs },
  bal: { marginBottom: space.lg },
  err: { marginBottom: space.sm },
  empty: { gap: space.xs, marginBottom: space.lg },
  list: { gap: space.md, marginBottom: space.lg },
  cta: { marginTop: space.sm },
  hint: { marginTop: space.md, textAlign: 'center' },
});
