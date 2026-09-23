import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  Switch,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text, StatusPill, Button, GlassPanel, UserAvatar } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { useWallets } from '@/wallets/WalletsContext';
import { canUseBiometrics } from '@/lib/biometrics';
import { formatMoney } from '@/lib/money';
import { colors, radii, shadows, space } from '@/theme';

function tierTone(tier?: string) {
  if (!tier || tier === 'tier_0') return 'warning' as const;
  return 'success' as const;
}

function tierLabel(tier?: string) {
  if (!tier) return 'Unknown';
  return tier.replace('_', ' ').replace('tier', 'Tier');
}

function ToolTile({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.tile} onPress={onPress}>
      <View style={styles.tileIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Text variant="bodyMedium">{title}</Text>
      <Text variant="caption" color={colors.textMuted}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

function SettingRow({
  icon,
  title,
  value,
  onPress,
  trailing,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  value?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
}) {
  const content = (
    <>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={18} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium">{title}</Text>
        {value ? (
          <Text variant="caption" color={colors.textMuted}>
            {value}
          </Text>
        ) : null}
      </View>
      {trailing ??
        (onPress ? (
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        ) : null)}
    </>
  );

  if (onPress) {
    return (
      <Pressable style={styles.setting} onPress={onPress}>
        {content}
      </Pressable>
    );
  }

  return <View style={styles.setting}>{content}</View>;
}

export default function ProfileScreen() {
  const {
    user,
    signOut,
    refreshUser,
    biometricsEnabled,
    pinSet,
    updateBiometricsEnabled,
  } = useAuth();
  const { walletFor, wallets, refresh } = useWallets();
  const [refreshing, setRefreshing] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [bioLabel, setBioLabel] = useState('Biometrics');
  const [bioAvailable, setBioAvailable] = useState(true);
  const needsKyc = user?.kycTier === 'tier_0';
  const ngn = walletFor('NGN');
  const usd = walletFor('USD');

  useEffect(() => {
    void canUseBiometrics().then((gate) => {
      setBioLabel(gate.label);
      setBioAvailable(gate.available);
    });
  }, []);

  const corridorHint = useMemo(() => {
    const codes = wallets.map((w) => w.currency).filter(Boolean);
    if (!codes.length) return 'NGN · USD · EUR';
    return codes.slice(0, 4).join(' · ');
  }, [wallets]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  return (
    <Screen scroll={false} style={{ paddingHorizontal: 0 }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await Promise.all([refreshUser(), refresh()]);
              setRefreshing(false);
            }}
            tintColor={colors.accent}
          />
        }
      >
        <LinearGradient
          colors={['#0D2B4E', '#163A63', '#1A73C1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroSheen} pointerEvents="none" />
          <Text variant="caption" color="rgba(255,255,255,0.7)">
            Cross-border account
          </Text>
          <View style={styles.avatarRow}>
            <Pressable onPress={() => router.push('/edit-profile')}>
              <UserAvatar uri={user?.avatarUrl} name={user?.tag} size={72} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text variant="h2" color="#fff">
                {user?.tag ? `@${user.tag}` : 'NovaPay member'}
              </Text>
              <Text variant="caption" color="rgba(255,255,255,0.75)">
                {user?.phone}
              </Text>
              <Pressable
                onPress={() => router.push('/edit-profile')}
                style={styles.editLink}
              >
                <Text variant="caption" color="#fff">
                  Edit photo & username
                </Text>
              </Pressable>
            </View>
            <StatusPill label={tierLabel(user?.kycTier)} tone={tierTone(user?.kycTier)} />
          </View>

          <GlassPanel tone="dark">
            <View style={styles.heroStatsRow}>
              <View style={styles.stat}>
                <Text variant="caption" color="rgba(255,255,255,0.65)">
                  NGN
                </Text>
                <Text variant="bodyMedium" color="#fff">
                  {ngn ? formatMoney(ngn.balanceMinor, 'NGN') : '₦0.00'}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text variant="caption" color="rgba(255,255,255,0.65)">
                  USD
                </Text>
                <Text variant="bodyMedium" color="#fff">
                  {usd ? formatMoney(usd.balanceMinor, 'USD') : '$0.00'}
                </Text>
              </View>
            </View>
          </GlassPanel>
          <Text variant="caption" color="rgba(255,255,255,0.65)" style={styles.corridor}>
            Wallets · {corridorHint}
          </Text>
        </LinearGradient>

        <View style={styles.body}>
          <GlassPanel>
            <View style={styles.verifyHead}>
              <Text variant="h3">Identity & limits</Text>
              <StatusPill
                label={needsKyc ? 'Action needed' : 'Verified'}
                tone={needsKyc ? 'warning' : 'success'}
              />
            </View>
            <Text variant="secondary">
              {needsKyc
                ? 'Finish verification to raise payout limits and unlock full corridors.'
                : 'You’re verified. Send limits follow your current KYC tier.'}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: needsKyc ? '35%' : '100%' },
                ]}
              />
            </View>
            <Button
              label={needsKyc ? 'Complete verification' : 'Refresh status'}
              variant={needsKyc ? 'primary' : 'secondary'}
              onPress={() =>
                needsKyc ? router.push('/(auth)/kyc') : void refreshUser()
              }
            />
          </GlassPanel>

          <Text variant="h3" style={styles.section}>
            Move money
          </Text>
          <View style={styles.grid}>
            <ToolTile
              icon="paper-plane-outline"
              title="Send"
              subtitle="Payouts · beneficiaries"
              onPress={() => router.push('/(tabs)/send')}
            />
            <ToolTile
              icon="cash-outline"
              title="Stablecoins"
              subtitle="USDC · USDT"
              onPress={() => router.push('/stables')}
            />
            <ToolTile
              icon="receipt-outline"
              title="Pay"
              subtitle="Bills · airtime"
              onPress={() => router.push('/bills')}
            />
            <ToolTile
              icon="arrow-down-circle-outline"
              title="Receive"
              subtitle="USD · EUR accounts"
              onPress={() => router.push('/receive')}
            />
            <ToolTile
              icon="card-outline"
              title="Cards"
              subtitle="Designs · spend"
              onPress={() => router.push('/(tabs)/cards')}
            />
            <ToolTile
              icon="business-outline"
              title="Business"
              subtitle="Orgs · bulk payouts"
              onPress={() => router.push('/business')}
            />
          </View>

          <Text variant="h3" style={styles.section}>
            Security & device
          </Text>
          <GlassPanel padded={false} style={styles.settingsPanel}>
            <SettingRow
              icon="lock-closed-outline"
              title="App PIN"
              value={pinSet ? 'Change PIN on this device' : 'Not set'}
              onPress={() => {
                if (!pinSet) {
                  router.push('/(auth)/pin-setup');
                  return;
                }
                router.push('/change-pin');
              }}
            />
            <SettingRow
              icon="finger-print-outline"
              title={bioLabel}
              value={
                !bioAvailable
                  ? `Set up ${bioLabel} in device settings`
                  : biometricsEnabled
                    ? `On for unlock & confirms`
                    : `Off — use PIN only`
              }
              trailing={
                <Switch
                  value={biometricsEnabled}
                  disabled={bioBusy || !pinSet || !bioAvailable}
                  onValueChange={(next) => {
                    void (async () => {
                      setBioBusy(true);
                      try {
                        await updateBiometricsEnabled(next);
                      } catch (e) {
                        Alert.alert(
                          bioLabel,
                          e instanceof Error
                            ? e.message
                            : `Could not update ${bioLabel}`,
                        );
                      } finally {
                        setBioBusy(false);
                      }
                    })();
                  }}
                  trackColor={{ true: colors.accent, false: colors.hairline }}
                />
              }
            />
            <SettingRow
              icon="shield-checkmark-outline"
              title="Payment confirmation"
              value={`PIN or ${bioLabel} for sends & card spend`}
              onPress={() =>
                Alert.alert(
                  'Payment confirmation',
                  `NovaPay asks for your PIN (or ${bioLabel}, if enabled) before sends, card spend, bills, and stablecoin moves. This can’t be turned off.`,
                )
              }
            />
            <SettingRow
              icon="headset-outline"
              title="Help & support"
              value="Report an issue to customer care"
              onPress={() => router.push('/help')}
            />
          </GlassPanel>

          <Button
            label="Sign out"
            variant="secondary"
            fullWidth
            style={styles.signOut}
            onPress={async () => {
              await signOut();
              router.replace('/(auth)/welcome');
            }}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: space.xxl },
  hero: {
    paddingHorizontal: space.md,
    paddingTop: space.lg,
    paddingBottom: space.xl,
    borderBottomLeftRadius: radii.xxl,
    borderBottomRightRadius: radii.xxl,
    overflow: 'hidden',
    gap: space.sm,
  },
  heroSheen: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.sm,
  },
  editLink: {
    marginTop: space.xs,
    alignSelf: 'flex-start',
    paddingVertical: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.5)',
  },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, gap: 2 },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginHorizontal: space.sm,
  },
  corridor: { marginTop: space.xs },
  body: { paddingHorizontal: space.md, marginTop: -space.md, gap: space.md },
  verifyHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  section: { marginTop: space.sm },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  tile: {
    width: '48%',
    flexGrow: 1,
    minWidth: '46%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: space.md,
    gap: space.xxs,
    ...shadows.card,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  settingsPanel: { overflow: 'hidden' },
  setting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOut: { marginTop: space.md },
});
