import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Text, OtpInput, Button, KeyboardDoneAccessory, PIN_ACCESSORY_ID } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { canUseBiometrics } from '@/lib/biometrics';
import { colors, space } from '@/theme';

type Props = {
  title?: string;
  subtitle?: string;
  onSuccess: () => void | Promise<void>;
  onCancel: () => void;
  busy?: boolean;
};

/**
 * Re-auth gate for sensitive actions (send, etc.).
 * Offers Face ID / fingerprint when enabled, otherwise / as fallback: 4-digit PIN.
 */
export function ConfirmSecureAction({
  title,
  subtitle,
  onSuccess,
  onCancel,
  busy,
}: Props) {
  const { unlockWithPin, unlockWithBiometrics, biometricsEnabled, pinSet } =
    useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [bioLabel, setBioLabel] = useState('Biometrics');
  const submitting = useRef(false);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    void canUseBiometrics().then((gate) => setBioLabel(gate.label));
  }, []);

  useEffect(() => {
    if (biometricsEnabled) {
      void tryBio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pin.length === 4) {
      void tryPin(pin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  async function tryBio() {
    if (submitting.current) return;
    submitting.current = true;
    setChecking(true);
    setError(null);
    try {
      const result = await unlockWithBiometrics(`Confirm with ${bioLabel}`);
      if (result.ok) await onSuccessRef.current();
      else {
        submitting.current = false;
        if (result.error) setError(result.error);
      }
    } catch {
      submitting.current = false;
    } finally {
      setChecking(false);
    }
  }

  async function tryPin(value: string) {
    if (submitting.current) return;
    if (!pinSet) {
      setError('No PIN set on this device. Set one from onboarding.');
      setPin('');
      return;
    }
    submitting.current = true;
    setChecking(true);
    setError(null);
    try {
      const ok = await unlockWithPin(value);
      if (ok) {
        await onSuccessRef.current();
      } else {
        setError('Incorrect PIN');
        setPin('');
        submitting.current = false;
      }
    } catch {
      submitting.current = false;
    } finally {
      setChecking(false);
    }
  }

  const heading = title ?? (biometricsEnabled ? `Confirm with ${bioLabel}` : 'Confirm with PIN');
  const copy =
    subtitle ??
    (biometricsEnabled
      ? `Use ${bioLabel} or enter your PIN to authorize.`
      : 'Enter your NovaPay PIN to authorize this transfer.');

  return (
    <View style={styles.body}>
      <Text variant="h1">{heading}</Text>
      <Text variant="secondary">{copy}</Text>

      <OtpInput length={4} value={pin} onChange={setPin} autoFocus={!biometricsEnabled} />

      {error ? (
        <Text variant="caption" color={colors.error}>
          {error}
        </Text>
      ) : null}

      {(checking || busy) && (
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.md }} />
      )}

      {biometricsEnabled ? (
        <Pressable onPress={() => void tryBio()} style={styles.bio} disabled={checking || busy}>
          <Text variant="bodyMedium" color={colors.accent}>
            Use {bioLabel} instead
          </Text>
        </Pressable>
      ) : null}

      <Button
        label="Cancel"
        variant="ghost"
        fullWidth
        disabled={checking || busy}
        onPress={onCancel}
        style={{ marginTop: space.md }}
      />
      <KeyboardDoneAccessory nativeID={PIN_ACCESSORY_ID} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: space.sm, paddingBottom: space.lg },
  bio: { marginTop: space.lg, alignSelf: 'flex-start' },
});
