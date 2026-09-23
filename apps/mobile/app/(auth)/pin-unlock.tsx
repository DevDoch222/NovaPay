import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  Text,
  Button,
  OtpInput,
  UserAvatar,
  KeyboardDoneAccessory,
  PIN_ACCESSORY_ID,
} from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { canUseBiometrics, type BiometricKind } from '@/lib/biometrics';
import { colors, space } from '@/theme';

export default function PinUnlockScreen() {
  const {
    unlockWithPin,
    unlockWithBiometrics,
    biometricsEnabled,
    signOut,
    user,
  } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bioLabel, setBioLabel] = useState('Face ID');
  const [bioKind, setBioKind] = useState<BiometricKind>('face');
  const bioBusy = useRef(false);

  useEffect(() => {
    void canUseBiometrics().then((gate) => {
      setBioLabel(gate.label);
      setBioKind(gate.kind);
    });
  }, []);

  useEffect(() => {
    if (!biometricsEnabled) return;
    // Delay so the screen finishes mounting — back-to-back Face ID prompts fail in Expo Go
    const t = setTimeout(() => {
      void tryBio(true);
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pin.length === 4) void tryPin(pin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  async function tryBio(silentCancel = false) {
    if (bioBusy.current) return;
    bioBusy.current = true;
    setLoading(true);
    if (!silentCancel) setError(null);
    try {
      const gate = await canUseBiometrics();
      const label = gate.label || bioLabel;
      setBioLabel(label);
      setBioKind(gate.kind);
      const result = await unlockWithBiometrics(`Unlock NovaPay with ${label}`);
      if (result.ok) {
        router.replace('/');
        return;
      }
      if (result.error) setError(result.error);
    } finally {
      setLoading(false);
      bioBusy.current = false;
    }
  }

  async function tryPin(value: string) {
    setLoading(true);
    const ok = await unlockWithPin(value);
    setLoading(false);
    if (ok) {
      router.replace('/');
    } else {
      setError('Incorrect PIN');
      setPin('');
    }
  }

  const bioIcon: React.ComponentProps<typeof Ionicons>['name'] =
    bioKind === 'face' ? 'scan-outline' : 'finger-print-outline';

  return (
    <Screen>
      <View style={styles.content}>
        <UserAvatar
          uri={user?.avatarUrl}
          name={user?.tag}
          size={108}
          style={styles.avatar}
        />
        <Text variant="h2" style={styles.title}>
          Welcome back
        </Text>
        <Text variant="secondary" style={styles.sub}>
          {user?.tag ? `@${user.tag}` : 'Enter your PIN to continue'}
        </Text>
        <OtpInput length={4} value={pin} onChange={setPin} autoFocus={!biometricsEnabled} />
        {error ? (
          <Text variant="caption" color={colors.error} style={styles.error}>
            {error}
          </Text>
        ) : null}
        {biometricsEnabled ? (
          <Pressable
            onPress={() => void tryBio(false)}
            style={styles.bio}
            disabled={loading}
          >
            <Ionicons name={bioIcon} size={22} color={colors.accent} />
            <Text variant="bodyMedium" color={colors.accent}>
              Unlock with {bioLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Button
        label="Unlock with PIN"
        fullWidth
        loading={loading && pin.length === 4}
        disabled={pin.length < 4}
        onPress={() => tryPin(pin)}
        style={styles.cta}
      />
      <Pressable
        onPress={async () => {
          await signOut();
          router.replace('/(auth)/welcome');
        }}
        style={styles.logout}
      >
        <Text variant="caption" color={colors.textMuted}>
          Sign out of this device
        </Text>
      </Pressable>
      <KeyboardDoneAccessory nativeID={PIN_ACCESSORY_ID} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    marginTop: space.xl,
    gap: space.sm,
    flex: 1,
    alignItems: 'stretch',
  },
  avatar: { alignSelf: 'center', marginBottom: space.sm },
  title: { textAlign: 'center' },
  sub: { marginBottom: space.lg, textAlign: 'center' },
  error: { marginTop: space.sm, textAlign: 'center' },
  bio: {
    marginTop: space.lg,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  cta: { marginBottom: space.sm },
  logout: { alignItems: 'center', marginBottom: space.lg },
});
