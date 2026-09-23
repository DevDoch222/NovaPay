import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  Screen,
  Text,
  Button,
  TextField,
  StatusPill,
  GlassPanel,
  KeyboardDoneAccessory,
  FORM_ACCESSORY_ID,
} from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import {
  canApprovePayouts,
  canManageOrg,
  idemKey,
  type BulkBatchDetail,
  type BulkBatchSummary,
  type Organization,
  type OrgMember,
  type OrgWallet,
} from '@/lib/business-api';
import { formatMoney } from '@/lib/money';
import { ApiError, unwrapItems, type PaginatedResult } from '@/lib/api';
import { colors, radii, space } from '@/theme';

const accessoryId = Platform.OS === 'ios' ? FORM_ACCESSORY_ID : undefined;
type Tab = 'wallet' | 'team' | 'payouts';

export default function BusinessOrgScreen() {
  const { orgId: orgIdParam } = useLocalSearchParams<{ orgId: string }>();
  const orgId = Array.isArray(orgIdParam) ? orgIdParam[0] : orgIdParam;
  const { user, unlocked, authFetch } = useAuth();
  const authFetchRef = useRef(authFetch);
  authFetchRef.current = authFetch;

  const [org, setOrg] = useState<Organization | null>(null);
  const [wallet, setWallet] = useState<OrgWallet | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [batches, setBatches] = useState<BulkBatchSummary[]>([]);
  const [tab, setTab] = useState<Tab>('wallet');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [fundAmount, setFundAmount] = useState('100000');
  const [inviteTag, setInviteTag] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'approver' | 'member'>(
    'member',
  );

  const [payName, setPayName] = useState('');
  const [payAcct, setPayAcct] = useState('');
  const [payBank, setPayBank] = useState('058');
  const [payAmount, setPayAmount] = useState('5000');
  const [batchView, setBatchView] = useState<BulkBatchDetail | null>(null);

  const role = org?.role;
  const manage = canManageOrg(role);
  const approve = canApprovePayouts(role);

  const load = useCallback(async () => {
    if (!user || !orgId) return;
    const [orgsBody, w, mBody, bBody] = await Promise.all([
      authFetchRef.current<PaginatedResult<Organization> | Organization[]>(
        '/v1/business/organizations',
      ),
      authFetchRef.current<OrgWallet>(`/v1/business/organizations/${orgId}/wallet`),
      authFetchRef.current<PaginatedResult<OrgMember> | OrgMember[]>(
        `/v1/business/organizations/${orgId}/members`,
      ),
      authFetchRef.current<PaginatedResult<BulkBatchSummary> | BulkBatchSummary[]>(
        `/v1/business/organizations/${orgId}/bulk-payouts`,
      ),
    ]);
    const orgs = unwrapItems(orgsBody);
    const m = unwrapItems(mBody);
    const b = unwrapItems(bBody);
    const found = orgs.find((o) => o.id === orgId) ?? null;
    setOrg(found);
    setWallet(w);
    setMembers(m);
    setBatches(b);
  }, [user, orgId]);

  useEffect(() => {
    if (!user || !unlocked) router.replace('/');
  }, [user, unlocked]);

  useFocusEffect(
    useCallback(() => {
      if (!orgId) return;
      setLoading(true);
      void load()
        .catch((e) =>
          setError(e instanceof ApiError ? e.message : 'Could not load organization'),
        )
        .finally(() => setLoading(false));
    }, [load, orgId]),
  );

  async function fundWallet() {
    if (!orgId) return;
    const amountMajor = Math.floor(Number(fundAmount));
    if (!Number.isFinite(amountMajor) || amountMajor < 1) {
      setError('Enter a valid fund amount');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await authFetchRef.current<{ balanceMinor: string }>(
        `/v1/business/organizations/${orgId}/wallet/fund`,
        {
          method: 'POST',
          body: { amountMajor, idempotencyKey: idemKey('orgfund') },
        },
      );
      setWallet((w) => (w ? { ...w, balanceMinor: res.balanceMinor } : w));
      Alert.alert('Funded', 'Sandbox credit applied to the org wallet.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Funding failed');
    } finally {
      setBusy(false);
    }
  }

  async function invite() {
    if (!orgId) return;
    const tag = inviteTag.trim().replace(/^@/, '');
    if (tag.length < 3) {
      setError('Enter a NovaPay username (tag)');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await authFetchRef.current(`/v1/business/organizations/${orgId}/members`, {
        method: 'POST',
        body: { tag, role: inviteRole },
      });
      setInviteTag('');
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Invite failed');
    } finally {
      setBusy(false);
    }
  }

  async function createBulk() {
    if (!orgId) return;
    const amountMajor = Math.floor(Number(payAmount));
    if (!payName.trim() || payAcct.trim().length < 6 || amountMajor < 1) {
      setError('Fill recipient name, account number, and amount');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const batch = await authFetchRef.current<BulkBatchDetail>(
        `/v1/business/organizations/${orgId}/bulk-payouts`,
        {
          method: 'POST',
          body: {
            idempotencyKey: idemKey('bulk'),
            items: [
              {
                accountName: payName.trim(),
                accountNumber: payAcct.trim(),
                bankCode: payBank.trim() || undefined,
                amountMajor,
              },
            ],
          },
        },
      );
      setBatchView(batch);
      setPayName('');
      setPayAcct('');
      await load();
      if (batch.status === 'pending_approval') {
        Alert.alert(
          'Pending approval',
          'This batch exceeds the auto-approve limit. Another owner/admin/approver must approve it.',
        );
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Bulk payout failed');
    } finally {
      setBusy(false);
    }
  }

  async function approveBatch(batchId: string) {
    if (!orgId) return;
    setBusy(true);
    setError(null);
    try {
      const batch = await authFetchRef.current<BulkBatchDetail>(
        `/v1/business/organizations/${orgId}/bulk-payouts/${batchId}/approve`,
        { method: 'POST' },
      );
      setBatchView(batch);
      await load();
      Alert.alert('Approved', 'Batch is processing.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Approval failed');
    } finally {
      setBusy(false);
    }
  }

  async function openBatch(batchId: string) {
    if (!orgId) return;
    setBusy(true);
    try {
      const batch = await authFetchRef.current<BulkBatchDetail>(
        `/v1/business/organizations/${orgId}/bulk-payouts/${batchId}`,
      );
      setBatchView(batch);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load batch');
    } finally {
      setBusy(false);
    }
  }

  const tabs = useMemo(
    () =>
      [
        { key: 'wallet' as const, label: 'Wallet' },
        { key: 'team' as const, label: 'Team' },
        { key: 'payouts' as const, label: 'Payouts' },
      ] as const,
    [],
  );

  if (!user || !unlocked || !orgId) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text variant="bodyMedium" color={colors.accent}>
              Back
            </Text>
          </Pressable>
          <Text variant="h3" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
            {org?.name ?? 'Organization'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {loading || !org ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  try {
                    await load();
                  } finally {
                    setRefreshing(false);
                  }
                }}
                tintColor={colors.accent}
              />
            }
          >
            <GlassPanel>
              <Text variant="caption" color={colors.textMuted}>
                @{org.slug} · your role {org.role}
              </Text>
              <Text variant="h2" style={{ marginTop: space.xs }}>
                {wallet
                  ? formatMoney(wallet.balanceMinor, wallet.currency)
                  : '—'}
              </Text>
              <Text variant="caption" color={colors.textMuted}>
                Auto-approve up to{' '}
                {formatMoney(org.approvalLimitMinor, 'NGN')}
              </Text>
            </GlassPanel>

            <View style={styles.tabs}>
              {tabs.map((t) => (
                <Pressable
                  key={t.key}
                  style={[styles.tab, tab === t.key && styles.tabActive]}
                  onPress={() => setTab(t.key)}
                >
                  <Text
                    variant="bodyMedium"
                    color={tab === t.key ? colors.textOnPrimary : colors.text}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {tab === 'wallet' && manage ? (
              <GlassPanel style={styles.block}>
                <Text variant="h3">Sandbox fund</Text>
                <TextField
                  label="Amount (₦)"
                  value={fundAmount}
                  onChangeText={setFundAmount}
                  keyboardType="number-pad"
                  inputAccessoryViewID={accessoryId}
                />
                <Button
                  label={busy ? 'Funding…' : 'Add funds'}
                  fullWidth
                  loading={busy}
                  onPress={() => void fundWallet()}
                />
              </GlassPanel>
            ) : null}
            {tab === 'wallet' && !manage ? (
              <Text variant="secondary">
                Only owners and admins can fund the org wallet in sandbox.
              </Text>
            ) : null}

            {tab === 'team' ? (
              <View style={styles.block}>
                {members.map((m) => (
                  <View key={m.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyMedium">
                        {m.tag ? `@${m.tag}` : m.userId.slice(0, 8)}
                      </Text>
                      <Text variant="caption" color={colors.textMuted}>
                        {m.phone ?? '—'}
                      </Text>
                    </View>
                    <StatusPill label={m.role} tone="info" />
                  </View>
                ))}
                {manage ? (
                  <GlassPanel style={{ gap: space.sm, marginTop: space.sm }}>
                    <Text variant="h3">Invite teammate</Text>
                    <TextField
                      label="Username"
                      value={inviteTag}
                      onChangeText={setInviteTag}
                      autoCapitalize="none"
                      placeholder="novaxxxx"
                      inputAccessoryViewID={accessoryId}
                    />
                    <View style={styles.roleRow}>
                      {(['member', 'approver', 'admin'] as const).map((r) => (
                        <Pressable
                          key={r}
                          style={[
                            styles.roleChip,
                            inviteRole === r && styles.roleChipActive,
                          ]}
                          onPress={() => setInviteRole(r)}
                        >
                          <Text
                            variant="caption"
                            color={
                              inviteRole === r ? colors.textOnPrimary : colors.text
                            }
                          >
                            {r}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Button
                      label={busy ? 'Inviting…' : 'Send invite'}
                      fullWidth
                      loading={busy}
                      onPress={() => void invite()}
                    />
                  </GlassPanel>
                ) : null}
              </View>
            ) : null}

            {tab === 'payouts' ? (
              <View style={styles.block}>
                {approve ? (
                  <GlassPanel style={{ gap: space.sm }}>
                    <Text variant="h3">New bulk payout</Text>
                    <TextField
                      label="Account name"
                      value={payName}
                      onChangeText={setPayName}
                      inputAccessoryViewID={accessoryId}
                    />
                    <TextField
                      label="Account number"
                      value={payAcct}
                      onChangeText={setPayAcct}
                      keyboardType="number-pad"
                      inputAccessoryViewID={accessoryId}
                    />
                    <TextField
                      label="Bank code"
                      value={payBank}
                      onChangeText={setPayBank}
                      inputAccessoryViewID={accessoryId}
                    />
                    <TextField
                      label="Amount (₦)"
                      value={payAmount}
                      onChangeText={setPayAmount}
                      keyboardType="number-pad"
                      inputAccessoryViewID={accessoryId}
                    />
                    <Button
                      label={busy ? 'Submitting…' : 'Submit batch'}
                      fullWidth
                      loading={busy}
                      onPress={() => void createBulk()}
                    />
                  </GlassPanel>
                ) : (
                  <Text variant="secondary">
                    Your role can view payouts but not create them.
                  </Text>
                )}

                <Text variant="h3" style={{ marginTop: space.md }}>
                  Recent batches
                </Text>
                {batches.length === 0 ? (
                  <Text variant="caption" color={colors.textMuted}>
                    No bulk payouts yet
                  </Text>
                ) : (
                  batches.map((b) => (
                    <Pressable
                      key={b.id}
                      style={styles.row}
                      onPress={() => void openBatch(b.id)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyMedium">
                          {formatMoney(b.totalAmountMinor, b.currency)}
                        </Text>
                        <Text variant="caption" color={colors.textMuted}>
                          {b.itemCount} item(s)
                        </Text>
                      </View>
                      <StatusPill
                        label={b.status.replace('_', ' ')}
                        tone={
                          b.status === 'completed'
                            ? 'success'
                            : b.status === 'pending_approval'
                              ? 'warning'
                              : 'info'
                        }
                      />
                    </Pressable>
                  ))
                )}

                {batchView ? (
                  <GlassPanel style={{ gap: space.sm, marginTop: space.sm }}>
                    <Text variant="h3">Batch detail</Text>
                    <Text variant="caption">
                      {batchView.status} ·{' '}
                      {formatMoney(batchView.totalAmountMinor, batchView.currency)}
                    </Text>
                    {batchView.items.map((i) => (
                      <View key={i.id} style={styles.item}>
                        <Text variant="bodyMedium">{i.accountName}</Text>
                        <Text variant="caption" color={colors.textMuted}>
                          {i.accountNumber} · {formatMoney(i.amountMinor, 'NGN')} ·{' '}
                          {i.status}
                        </Text>
                        {i.failureReason ? (
                          <Text variant="caption" color={colors.error}>
                            {i.failureReason}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                    {batchView.status === 'pending_approval' &&
                    approve &&
                    batchView.createdByUserId !== user.id ? (
                      <Button
                        label={busy ? 'Approving…' : 'Approve batch'}
                        fullWidth
                        loading={busy}
                        onPress={() => void approveBatch(batchView.id)}
                      />
                    ) : null}
                    {batchView.status === 'pending_approval' &&
                    batchView.createdByUserId === user.id ? (
                      <Text variant="caption" color={colors.textMuted}>
                        You created this batch — another approver must confirm it.
                      </Text>
                    ) : null}
                    <Button
                      label="Close"
                      variant="ghost"
                      fullWidth
                      onPress={() => setBatchView(null)}
                    />
                  </GlassPanel>
                ) : null}
              </View>
            ) : null}

            {error ? (
              <Text variant="caption" color={colors.error}>
                {error}
              </Text>
            ) : null}
          </ScrollView>
        )}
        <KeyboardDoneAccessory nativeID={FORM_ACCESSORY_ID} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.sm,
    marginBottom: space.md,
    gap: space.sm,
  },
  body: { paddingBottom: space.xxl, gap: space.md },
  tabs: { flexDirection: 'row', gap: space.xs },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.sm,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
  },
  tabActive: { backgroundColor: colors.primary },
  block: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  roleRow: { flexDirection: 'row', gap: space.xs },
  roleChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  roleChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  item: { gap: 2 },
});
