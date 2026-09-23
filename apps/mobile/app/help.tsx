import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  RefreshControl,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  Text,
  Button,
  TextField,
  GlassPanel,
  StatusPill,
  KeyboardDoneAccessory,
  FORM_ACCESSORY_ID,
} from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { ApiError } from '@/lib/api';
import {
  createTicket,
  listMyTickets,
  type SupportTicket,
} from '@/lib/support-api';
import { colors, radii, space } from '@/theme';

const accessoryId = Platform.OS === 'ios' ? FORM_ACCESSORY_ID : undefined;

function statusTone(status: string) {
  if (status === 'resolved' || status === 'closed') return 'success' as const;
  if (status === 'waiting_customer') return 'warning' as const;
  return 'neutral' as const;
}

export default function HelpScreen() {
  const { user, unlocked, authFetch } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setTickets(await listMyTickets(authFetch));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load tickets');
    }
  }, [authFetch]);

  useFocusEffect(
    useCallback(() => {
      if (!user || !unlocked) {
        router.replace('/');
        return;
      }
      void load();
    }, [user, unlocked, load]),
  );

  async function submit() {
    if (subject.trim().length < 3 || body.trim().length < 1) {
      Alert.alert('Help', 'Add a short subject and describe the issue.');
      return;
    }
    setBusy(true);
    try {
      const detail = await createTicket(authFetch, {
        subject: subject.trim(),
        body: body.trim(),
        category: 'general',
      });
      setSubject('');
      setBody('');
      setComposing(false);
      router.push(`/help-ticket?id=${detail.ticket.id}`);
    } catch (e) {
      Alert.alert(
        'Help',
        e instanceof ApiError ? e.message : 'Could not open ticket',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!user || !unlocked) return null;

  return (
    <Screen scroll={false} style={{ paddingHorizontal: 0 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h3">Help & support</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
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
          <Text variant="secondary" style={styles.intro}>
            Report a problem or message customer care. Our team replies in the
            Ops console — you’ll see updates here.
          </Text>

          {!composing ? (
            <Button
              label="Report an issue"
              onPress={() => setComposing(true)}
              fullWidth
            />
          ) : (
            <GlassPanel style={styles.compose}>
              <Text variant="h3">New request</Text>
              <TextField
                label="Subject"
                value={subject}
                onChangeText={setSubject}
                placeholder="e.g. Payout delayed"
                inputAccessoryViewID={accessoryId}
              />
              <TextField
                label="What happened?"
                value={body}
                onChangeText={setBody}
                placeholder="Share details, amounts, or transaction ids…"
                multiline
                numberOfLines={5}
                style={{ minHeight: 120, textAlignVertical: 'top' }}
                inputAccessoryViewID={accessoryId}
              />
              <View style={styles.composeActions}>
                <Button
                  label="Cancel"
                  variant="secondary"
                  onPress={() => setComposing(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  label={busy ? 'Sending…' : 'Send'}
                  onPress={() => void submit()}
                  disabled={busy}
                  style={{ flex: 1 }}
                />
              </View>
            </GlassPanel>
          )}

          <Text variant="h3" style={styles.section}>
            Your requests
          </Text>
          {error ? (
            <Text variant="caption" color={colors.error}>
              {error}
            </Text>
          ) : null}
          {tickets.length === 0 ? (
            <GlassPanel>
              <Text variant="secondary">
                No open requests yet. Tap “Report an issue” when you need help.
              </Text>
            </GlassPanel>
          ) : (
            tickets.map((t) => (
              <Pressable
                key={t.id}
                style={styles.ticket}
                onPress={() => router.push(`/help-ticket?id=${t.id}`)}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text variant="bodyMedium">{t.subject}</Text>
                  <Text variant="caption" color={colors.textMuted}>
                    Updated {new Date(t.updatedAt).toLocaleString()}
                  </Text>
                </View>
                <StatusPill label={t.status.replace('_', ' ')} tone={statusTone(t.status)} />
              </Pressable>
            ))
          )}
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
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  scroll: {
    paddingHorizontal: space.md,
    paddingBottom: space.xxl,
    gap: space.md,
  },
  intro: { marginBottom: space.xs },
  compose: { gap: space.sm },
  composeActions: { flexDirection: 'row', gap: space.sm },
  section: { marginTop: space.sm },
  ticket: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: space.md,
  },
});
