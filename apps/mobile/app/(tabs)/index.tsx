import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Screen,
  Text,
  MoneyText,
  Card,
  StatusPill,
  Button,
  GlassPanel,
  UserAvatar,
} from '@/components/ui';
import { TxnDetailSheet, TxnRow } from '@/components/activity/TxnViews';
import { useAuth } from '@/auth/AuthContext';
import { useWallets } from '@/wallets/WalletsContext';
import { formatMoney } from '@/lib/money';
import type { Transaction } from '@/lib/money-types';
import { colors, radii, shadows, space } from '@/theme';

type QuickIcon = React.ComponentProps<typeof Ionicons>['name'];

const QUICK: {
  key: string;
  label: string;
  icon: QuickIcon;
  href: '/fund' | '/(tabs)/send' | '/convert' | '/receive';
}[] = [
  { key: 'add', label: 'Add', icon: 'add', href: '/fund' },
  { key: 'send', label: 'Send', icon: 'paper-plane', href: '/(tabs)/send' },
  { key: 'convert', label: 'Convert', icon: 'swap-horizontal', href: '/convert' },
  { key: 'receive', label: 'Receive', icon: 'arrow-down', href: '/receive' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const { user } = useAuth();
  const {
    wallets,
    transactions,
    loading,
    refreshing,
    error,
    homeCurrency,
    setHomeCurrency,
    refresh,
    totalInHomeCurrency,
  } = useWallets();

  const [pickedTxn, setPickedTxn] = useState<Transaction | null>(null);
  const total = totalInHomeCurrency();
  const needsKyc = user?.kycTier === 'tier_0';

  const recent = useMemo(() => transactions.slice(0, 5), [transactions]);

  const displayWallets =
    wallets.length > 0
      ? wallets.filter((w) =>
          ['NGN', 'USD', 'EUR', 'USDC', 'USDT'].includes(w.currency),
        )
      : [
          { id: 'ngn', currency: 'NGN', balanceMinor: '0', status: 'active', createdAt: '' },
          { id: 'usd', currency: 'USD', balanceMinor: '0', status: 'active', createdAt: '' },
          { id: 'eur', currency: 'EUR', balanceMinor: '0', status: 'active', createdAt: '' },
        ];

  return (
    <Screen scroll={false} style={{ paddingHorizontal: 0 }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
      >
        <View style={styles.header}>
          <View>
            <Text variant="caption" color={colors.accent}>
              NovaPay
            </Text>
            <Text variant="h2">{greeting()}</Text>
            {user?.tag ? (
              <Text variant="caption" color={colors.textSecondary}>
                @{user.tag}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={() => router.push('/(tabs)/profile')}>
            <UserAvatar uri={user?.avatarUrl} name={user?.tag} size={40} />
          </Pressable>
        </View>

        <View style={[styles.balanceShell, shadows.depth]}>
          <LinearGradient
            colors={['#163A63', '#0D2B4E', '#1A73C1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceCard}
          >
            <View style={styles.balanceSheen} pointerEvents="none" />
            <Pressable
              onPress={() => {
                const codes = displayWallets.map((w) => w.currency);
                const i = codes.indexOf(homeCurrency);
                setHomeCurrency(codes[(i + 1) % codes.length]);
              }}
            >
              <Text variant="caption" color="rgba(255,255,255,0.72)">
                Total balance · {homeCurrency} · tap to switch
              </Text>
              {loading && !wallets.length ? (
                <ActivityIndicator color="#fff" style={{ marginVertical: space.md }} />
              ) : (
                <MoneyText size="lg" color={colors.textOnPrimary} style={styles.balance}>
                  {formatMoney(total.minor, total.currency)}
                </MoneyText>
              )}
            </Pressable>
            <StatusPill
              label={
                needsKyc
                  ? 'Complete verification to raise limits'
                  : error
                    ? refreshing
                      ? 'Retrying…'
                      : 'Couldn’t sync — tap to retry'
                    : 'Live wallets'
              }
              tone={needsKyc ? 'warning' : error ? 'error' : 'success'}
            />
            {error ? (
              <Pressable onPress={() => void refresh()}>
                <Text variant="caption" color="rgba(255,255,255,0.75)">
                  {error.includes('Session expired')
                    ? 'Session expired. Sign out and sign in again from Profile.'
                    : error.slice(0, 120)}
                </Text>
              </Pressable>
            ) : null}
            <View style={styles.balanceActions}>
              <Pressable
                style={styles.sendCta}
                onPress={() => router.push('/(tabs)/send')}
              >
                <Ionicons name="paper-plane" size={16} color={colors.primary} />
                <Text variant="bodyMedium" color={colors.primary}>
                  Send money
                </Text>
              </Pressable>
              <Pressable style={styles.addCta} onPress={() => router.push('/fund')}>
                <Text variant="bodyMedium" color="#fff">
                  Add
                </Text>
              </Pressable>
            </View>
          </LinearGradient>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.currencyRow}
          style={styles.currencyScroll}
        >
          {displayWallets.map((c) => (
            <Pressable key={c.id} onPress={() => setHomeCurrency(c.currency)}>
              <Card
                style={[
                  styles.currencyCard,
                  homeCurrency === c.currency && styles.currencyActive,
                ]}
                elevated={false}
              >
                <Text variant="caption" color={colors.textSecondary}>
                  {c.currency}
                </Text>
                <MoneyText size="md">
                  {formatMoney(c.balanceMinor, c.currency)}
                </MoneyText>
              </Card>
            </Pressable>
          ))}
        </ScrollView>

        <GlassPanel style={styles.quickGlass} padded>
          <View style={styles.quickRow}>
            {QUICK.map((q) => (
              <Pressable
                key={q.key}
                style={styles.quickItem}
                accessibilityLabel={q.label}
                onPress={() => {
                  if (q.href) router.push(q.href);
                }}
              >
                <View style={styles.quickIcon}>
                  <Ionicons name={q.icon} size={22} color={colors.primary} />
                </View>
                <Text variant="caption" style={styles.quickLabel}>
                  {q.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </GlassPanel>

        <View style={styles.sectionHeader}>
          <Text variant="h3">Recent activity</Text>
          <Pressable onPress={() => router.push('/(tabs)/activity')}>
            <Text variant="caption" color={colors.accent}>
              See all
            </Text>
          </Pressable>
        </View>

        {recent.length === 0 ? (
          <Card>
            <Text variant="secondary">
              No transactions yet. Fund your wallet to get started.
            </Text>
            <Button
              label="Add money"
              style={styles.cta}
              onPress={() => router.push('/fund')}
            />
          </Card>
        ) : (
          <View style={styles.txnList}>
            {recent.map((txn) => (
              <TxnRow key={txn.id} txn={txn} onPress={() => setPickedTxn(txn)} />
            ))}
          </View>
        )}
      </ScrollView>

      <TxnDetailSheet txn={pickedTxn} onClose={() => setPickedTxn(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: space.md,
    paddingBottom: space.xxl,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.lg,
    marginTop: space.sm,
  },
  balanceShell: {
    borderRadius: radii.xl,
    marginBottom: space.md,
    overflow: 'hidden',
  },
  balanceCard: {
    gap: space.sm,
    padding: space.md,
    minHeight: 168,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  balanceSheen: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  balance: { marginVertical: space.xxs },
  balanceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xs,
  },
  sendCta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    backgroundColor: '#fff',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radii.md,
  },
  addCta: {
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  currencyScroll: { marginHorizontal: -space.md, marginBottom: space.md },
  currencyRow: { paddingHorizontal: space.md, gap: space.sm },
  currencyCard: { width: 140, gap: space.xs },
  currencyActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  quickGlass: { marginBottom: space.lg },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickItem: { alignItems: 'center', width: '22%' },
  quickIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  quickLabel: { textAlign: 'center' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  cta: { marginTop: space.md },
  txnList: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: space.md,
  },
});
