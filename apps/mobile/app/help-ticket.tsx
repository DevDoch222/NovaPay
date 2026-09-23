import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
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
  getTicket,
  reopenTicket,
  replyTicket,
  type SupportTicketDetail,
} from '@/lib/support-api';
import { colors, radii, space } from '@/theme';

const accessoryId = Platform.OS === 'ios' ? FORM_ACCESSORY_ID : undefined;

function isClosedStatus(status?: string) {
  return status === 'resolved' || status === 'closed';
}

export default function HelpTicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, unlocked, authFetch } = useAuth();
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setDetail(await getTicket(authFetch, id));
  }, [authFetch, id]);

  useFocusEffect(
    useCallback(() => {
      if (!user || !unlocked) {
        router.replace('/');
        return;
      }
      void load().catch((e) => {
        Alert.alert(
          'Help',
          e instanceof ApiError ? e.message : 'Could not load ticket',
        );
      });
    }, [user, unlocked, load]),
  );

  const closed = isClosedStatus(detail?.ticket.status);

  async function sendReply() {
    if (!id || !reply.trim()) return;
    setBusy(true);
    try {
      // Reply on a closed ticket also reopens it for customer care
      setDetail(await replyTicket(authFetch, id, reply.trim()));
      setReply('');
    } catch (e) {
      Alert.alert(
        'Help',
        e instanceof ApiError ? e.message : 'Could not send reply',
      );
    } finally {
      setBusy(false);
    }
  }

  async function reopenOnly() {
    if (!id) return;
    setBusy(true);
    try {
      setDetail(
        await reopenTicket(
          authFetch,
          id,
          reply.trim() || undefined,
        ),
      );
      setReply('');
    } catch (e) {
      Alert.alert(
        'Help',
        e instanceof ApiError ? e.message : 'Could not reopen ticket',
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
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h3" numberOfLines={1} style={{ flex: 1 }}>
            {detail?.ticket.subject ?? 'Ticket'}
          </Text>
          {detail ? (
            <StatusPill
              label={detail.ticket.status.replace('_', ' ')}
              tone={closed ? 'success' : 'neutral'}
            />
          ) : (
            <View style={{ width: 24 }} />
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
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
          {detail?.messages.map((m) => (
            <View
              key={m.id}
              style={[
                styles.bubble,
                m.isStaff ? styles.staffBubble : styles.customerBubble,
              ]}
            >
              <Text variant="caption" color={colors.textMuted}>
                {m.isStaff ? 'NovaPay support' : 'You'} ·{' '}
                {new Date(m.createdAt).toLocaleString()}
              </Text>
              <Text variant="body">{m.body}</Text>
            </View>
          ))}
        </ScrollView>

        <GlassPanel style={styles.composer}>
          {closed ? (
            <Text variant="secondary">
              This request was marked {detail?.ticket.status}. Reply to reopen
              it and message customer care again.
            </Text>
          ) : null}
          <TextField
            label={closed ? 'Message to reopen' : 'Reply'}
            value={reply}
            onChangeText={setReply}
            placeholder={
              closed
                ? 'Tell us what still needs help…'
                : 'Add more details…'
            }
            multiline
            numberOfLines={3}
            style={{ minHeight: 72, textAlignVertical: 'top' }}
            inputAccessoryViewID={accessoryId}
          />
          {closed ? (
            <View style={styles.actions}>
              <Button
                label={busy ? 'Working…' : 'Reopen'}
                variant="secondary"
                onPress={() => void reopenOnly()}
                disabled={busy}
                style={{ flex: 1 }}
              />
              <Button
                label={busy ? 'Sending…' : 'Reopen & reply'}
                onPress={() => void sendReply()}
                disabled={busy || !reply.trim()}
                style={{ flex: 1 }}
              />
            </View>
          ) : (
            <Button
              label={busy ? 'Sending…' : 'Send reply'}
              onPress={() => void sendReply()}
              disabled={busy || !reply.trim()}
              fullWidth
            />
          )}
        </GlassPanel>
        <KeyboardDoneAccessory nativeID={FORM_ACCESSORY_ID} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  scroll: {
    paddingHorizontal: space.md,
    paddingBottom: space.lg,
    gap: space.sm,
  },
  bubble: {
    borderRadius: radii.lg,
    padding: space.md,
    gap: 4,
  },
  customerBubble: {
    backgroundColor: colors.primarySoft,
    alignSelf: 'flex-end',
    maxWidth: '92%',
  },
  staffBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignSelf: 'flex-start',
    maxWidth: '92%',
  },
  composer: {
    marginHorizontal: space.md,
    marginBottom: space.md,
    gap: space.sm,
  },
  actions: { flexDirection: 'row', gap: space.sm },
});
