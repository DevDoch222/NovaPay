import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import {
  Screen,
  Text,
  Button,
  OtpInput,
  KeyboardDoneAccessory,
  PIN_ACCESSORY_ID,
} from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { colors, space } from '@/theme';

type Phase = 'current' | 'create' | 'confirm';

export default function ChangePinScreen() {
  const { user, unlocked, unlockWithPin, changePin } = useAuth();
  const [phase, setPhase] = useState<Phase>('current');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !unlocked) router.replace('/');
  }, [user, unlocked]);

  useEffect(() => {
    if (phase === 'current' && current.length === 4) {
      void verifyCurrent(current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, phase]);

  useEffect(() => {
    if (phase === 'create' && next.length === 4) {
      setPhase('confirm');
      setError(null);
    }
  }, [next, phase]);

  useEffect(() => {
    if (phase === 'confirm' && confirm.length === 4) {
      void finish(confirm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirm, phase]);

  async function verifyCurrent(value: string) {
    setLoading(true);
    setError(null);
    const ok = await unlockWithPin(value);
    setLoading(false);
    if (!ok) {
      setError('Incorrect PIN');
      setCurrent('');
      return;
    }
    setPhase('create');
  }

  async function finish(value: string) {
    if (value !== next) {
      setError('PINs do not match');
      setConfirm('');
      setNext('');
      setPhase('create');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ok = await changePin(current, next);
      if (!ok) {
        setError('Could not update PIN — check your current PIN');
        setPhase('current');
        setCurrent('');
        setNext('');
        setConfirm('');
        return;
      }
      router.back();
    } finally {
      setLoading(false);
    }
  }

  if (!user || !unlocked) return null;

  const value =
    phase === 'current' ? current : phase === 'create' ? next : confirm;
  const onChange =
    phase === 'current'
      ? setCurrent
      : phase === 'create'
        ? setNext
        : setConfirm;

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text variant="bodyMedium" color={colors.accent}>
            Close
          </Text>
        </Pressable>
      </View>
      <View style={styles.content}>
        <Text variant="caption" color={colors.accent}>
          Security
        </Text>
        <Text variant="h1" style={styles.title}>
          {phase === 'current'
            ? 'Enter current PIN'
            : phase === 'create'
              ? 'Choose a new PIN'
              : 'Confirm new PIN'}
        </Text>
        <Text variant="secondary" style={styles.sub}>
          Your PIN unlocks the app and confirms sends, cards, and payments.
        </Text>
        <OtpInput length={4} value={value} onChange={onChange} autoFocus />
        {error ? (
          <Text variant="caption" color={colors.error} style={styles.error}>
            {error}
          </Text>
        ) : null}
      </View>
      <Button
        label={
          loading
            ? 'Working…'
            : phase === 'confirm'
              ? 'Save PIN'
              : 'Continue'
        }
        fullWidth
        loading={loading}
        disabled={value.length < 4}
        onPress={() => {
          if (phase === 'current') void verifyCurrent(current);
          else if (phase === 'create') setPhase('confirm');
          else void finish(confirm);
        }}
        style={styles.cta}
      />
      <KeyboardDoneAccessory nativeID={PIN_ACCESSORY_ID} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    marginBottom: space.md,
    marginTop: space.sm,
  },
  content: { flex: 1, gap: space.sm },
  title: { marginTop: space.xs },
  sub: { marginBottom: space.md },
  error: { marginTop: space.sm },
  cta: { marginBottom: space.lg },
});
