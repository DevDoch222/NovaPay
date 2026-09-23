import React, { useState } from 'react';
import { StyleSheet, View, Switch, Pressable } from 'react-native';
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
import { canUseBiometrics } from '@/lib/biometrics';
import { colors, space } from '@/theme';

export default function PinSetupScreen() {
  const { setupPin, user } = useAuth();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [phase, setPhase] = useState<'create' | 'confirm'>('create');
  const [error, setError] = useState<string | null>(null);
  const [biometrics, setBiometrics] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLabel, setBioLabel] = useState('Biometrics');

  React.useEffect(() => {
    void canUseBiometrics().then((gate) => {
      setBioAvailable(gate.available);
      setBioLabel(gate.label);
    });
  }, []);

  React.useEffect(() => {
    if (phase === 'create' && pin.length === 4) {
      setPhase('confirm');
    }
  }, [pin, phase]);

  React.useEffect(() => {
    if (phase === 'confirm' && confirm.length === 4) {
      void finish(confirm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirm, phase]);

  async function finish(value: string) {
    if (value !== pin) {
      setError('PINs do not match');
      setConfirm('');
      setPhase('create');
      setPin('');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await setupPin(pin, biometrics);
      if (user?.kycTier === 'tier_0') {
        router.replace('/(auth)/kyc');
      } else {
        router.replace('/(tabs)');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save PIN');
      setBiometrics(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.content}>
        <Text variant="caption" color={colors.accent}>
          Step 3 of 3
        </Text>
        <Text variant="h1" style={styles.title}>
          {phase === 'create' ? 'Create a PIN' : 'Confirm your PIN'}
        </Text>
        <Text variant="secondary" style={styles.sub}>
          Used to unlock NovaPay and confirm sensitive actions. Keep it private.
        </Text>
        <OtpInput
          length={4}
          value={phase === 'create' ? pin : confirm}
          onChange={phase === 'create' ? setPin : setConfirm}
          autoFocus
        />
        {error ? (
          <Text variant="caption" color={colors.error} style={styles.error}>
            {error}
          </Text>
        ) : null}

        {bioAvailable ? (
          <Pressable
            style={styles.bioRow}
            onPress={() => setBiometrics((v) => !v)}
          >
            <View style={styles.bioCopy}>
              <Text variant="bodyMedium">Unlock with {bioLabel}</Text>
              <Text variant="caption">
                Face ID or fingerprint when available on this device
              </Text>
            </View>
            <Switch
              value={biometrics}
              onValueChange={setBiometrics}
              trackColor={{ true: colors.accent, false: colors.hairline }}
            />
          </Pressable>
        ) : null}
      </View>
      <Button
        label={phase === 'create' ? 'Continue' : 'Save PIN'}
        fullWidth
        loading={loading}
        disabled={(phase === 'create' ? pin : confirm).length < 4}
        onPress={() => {
          if (phase === 'create') setPhase('confirm');
          else void finish(confirm);
        }}
        style={styles.cta}
      />
      <KeyboardDoneAccessory nativeID={PIN_ACCESSORY_ID} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { marginTop: space.lg, gap: space.sm, flex: 1 },
  title: { marginTop: space.xs },
  sub: { marginBottom: space.md },
  error: { marginTop: space.sm },
  bioRow: {
    marginTop: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  bioCopy: { flex: 1, gap: 2 },
  cta: { marginBottom: space.lg },
});
