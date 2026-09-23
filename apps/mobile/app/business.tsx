import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
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
import type { Organization } from '@/lib/business-api';
import { ApiError, unwrapItems, type PaginatedResult } from '@/lib/api';
import { colors, radii, space } from '@/theme';

const accessoryId = Platform.OS === 'ios' ? FORM_ACCESSORY_ID : undefined;

export default function BusinessScreen() {
  const { user, unlocked, authFetch } = useAuth();
  const authFetchRef = useRef(authFetch);
  authFetchRef.current = authFetch;

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [limit, setLimit] = useState('50000');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const body = await authFetchRef.current<
        PaginatedResult<Organization> | Organization[]
      >('/v1/business/organizations');
      setOrgs(unwrapItems(body));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load organizations');
    }
  }, [user]);

  useEffect(() => {
    if (!user || !unlocked) router.replace('/');
  }, [user, unlocked]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load]),
  );

  async function createOrg() {
    const n = name.trim();
    const s = (slug.trim() || n)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (n.length < 2 || s.length < 3) {
      setError('Enter a name and a valid slug (3+ chars)');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const org = await authFetchRef.current<Organization>(
        '/v1/business/organizations',
        {
          method: 'POST',
          body: {
            name: n,
            slug: s,
            approvalLimitMajor: Math.max(0, Math.floor(Number(limit) || 0)),
          },
        },
      );
      setCreating(false);
      setName('');
      setSlug('');
      await load();
      router.push({ pathname: '/business-org', params: { orgId: org.id } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create organization');
    } finally {
      setBusy(false);
    }
  }

  if (!user || !unlocked) {
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
              Close
            </Text>
          </Pressable>
          <Text variant="h3">Business</Text>
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
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="secondary">
            Organizations with NGN wallets, team roles, and approval-gated bulk payouts.
          </Text>

          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: space.lg }} />
          ) : orgs.length === 0 && !creating ? (
            <GlassPanel style={styles.empty}>
              <Text variant="h3">No organizations yet</Text>
              <Text variant="secondary">
                Create one to run payroll-style bulk payouts from a shared wallet.
              </Text>
            </GlassPanel>
          ) : (
            orgs.map((org) => (
              <Pressable
                key={org.id}
                style={styles.card}
                onPress={() =>
                  router.push({ pathname: '/business-org', params: { orgId: org.id } })
                }
              >
                <View style={styles.cardTop}>
                  <Text variant="bodyMedium">{org.name}</Text>
                  <StatusPill
                    label={(org.role ?? 'member').toUpperCase()}
                    tone="info"
                  />
                </View>
                <Text variant="caption" color={colors.textMuted}>
                  @{org.slug}
                </Text>
              </Pressable>
            ))
          )}

          {creating ? (
            <GlassPanel style={styles.form}>
              <Text variant="h3">New organization</Text>
              <TextField
                label="Name"
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  if (!slug) {
                    setSlug(
                      v
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, ''),
                    );
                  }
                }}
                placeholder="Ada Imports"
                inputAccessoryViewID={accessoryId}
              />
              <TextField
                label="Slug"
                value={slug}
                onChangeText={setSlug}
                autoCapitalize="none"
                placeholder="ada-imports"
                inputAccessoryViewID={accessoryId}
              />
              <TextField
                label="Auto-approve payouts up to (₦)"
                value={limit}
                onChangeText={setLimit}
                keyboardType="number-pad"
                inputAccessoryViewID={accessoryId}
              />
              <Button
                label={busy ? 'Creating…' : 'Create organization'}
                fullWidth
                loading={busy}
                onPress={() => void createOrg()}
              />
              <Button
                label="Cancel"
                variant="ghost"
                fullWidth
                disabled={busy}
                onPress={() => setCreating(false)}
              />
            </GlassPanel>
          ) : (
            <Button
              label="Create organization"
              fullWidth
              onPress={() => setCreating(true)}
              style={{ marginTop: space.md }}
            />
          )}

          {error ? (
            <Text variant="caption" color={colors.error}>
              {error}
            </Text>
          ) : null}
        </ScrollView>
        <KeyboardDoneAccessory nativeID={FORM_ACCESSORY_ID} />
      </KeyboardAvoidingView>
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
  },
  body: { paddingBottom: space.xxl, gap: space.sm },
  empty: { gap: space.sm, marginTop: space.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: space.md,
    gap: space.xxs,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  form: { gap: space.sm, marginTop: space.sm },
});
