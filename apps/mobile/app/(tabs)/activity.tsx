import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Screen, Text, Card, Button, StatusPill } from '@/components/ui';
import { TxnDetailSheet, TxnRow } from '@/components/activity/TxnViews';
import { useWallets } from '@/wallets/WalletsContext';
import { dayKey, formatDayHeading } from '@/lib/money';
import {
  matchesFilter,
  type ActivityFilter,
} from '@/lib/txn';
import type { Transaction } from '@/lib/money-types';
import { colors, radii, space } from '@/theme';

const FILTERS: { id: ActivityFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'sent', label: 'Sent' },
  { id: 'received', label: 'Received' },
  { id: 'converted', label: 'Converted' },
  { id: 'card', label: 'Card' },
];

export default function ActivityScreen() {
  const { transactions, refreshing, refresh, error } = useWallets();
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [picked, setPicked] = useState<Transaction | null>(null);

  const filtered = useMemo(
    () => transactions.filter((t) => matchesFilter(t, filter)),
    [transactions, filter],
  );

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const txn of filtered) {
      const key = dayKey(txn.createdAt);
      const list = map.get(key) ?? [];
      list.push(txn);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      heading: formatDayHeading(items[0].createdAt),
      items,
    }));
  }, [filtered]);

  return (
    <Screen scroll={false} style={{ paddingHorizontal: 0 }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />
        }
        stickyHeaderIndices={[1]}
      >
        <View style={styles.top}>
          <Text variant="h1">Activity</Text>
          <Text variant="secondary" style={styles.sub}>
            Filter by type. Tap any row for fee and reference details.
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          style={styles.filterBar}
        >
          {FILTERS.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[styles.chip, filter === f.id && styles.chipOn]}
            >
              <Text
                variant="caption"
                color={filter === f.id ? colors.accent : colors.textSecondary}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {error ? (
          <Text variant="caption" color={colors.error} style={styles.error}>
            {error}
          </Text>
        ) : null}

        {groups.length === 0 ? (
          <Card>
            <StatusPill label="Empty" tone="neutral" />
            <Text variant="bodyMedium" style={styles.emptyTitle}>
              No transaction history yet
            </Text>
            <Text variant="secondary">
              Add money to get started. Your sends, converts, and card spends will
              group here by day.
            </Text>
            <Button
              label="Add money"
              style={styles.cta}
              onPress={() => router.push('/fund')}
            />
          </Card>
        ) : (
          groups.map((g) => (
            <View key={g.key} style={styles.group}>
              <Text variant="caption" style={styles.heading}>
                {g.heading}
              </Text>
              <View style={styles.list}>
                {g.items.map((txn) => (
                  <TxnRow key={txn.id} txn={txn} onPress={() => setPicked(txn)} />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <TxnDetailSheet txn={picked} onClose={() => setPicked(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: space.md,
    paddingBottom: space.xxl,
  },
  top: { marginTop: space.sm, marginBottom: space.sm },
  sub: { marginTop: space.xs },
  filterBar: {
    backgroundColor: colors.background,
    marginBottom: space.md,
    marginHorizontal: -space.md,
  },
  filters: {
    paddingHorizontal: space.md,
    gap: space.xs,
    paddingVertical: space.xs,
  },
  chip: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  chipOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  error: { marginBottom: space.sm },
  emptyTitle: { marginTop: space.md, marginBottom: space.xs, color: colors.text },
  cta: { marginTop: space.md },
  group: { marginBottom: space.lg },
  heading: {
    marginBottom: space.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: space.md,
  },
});
