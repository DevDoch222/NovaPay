import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Screen, Text, Button, OtpInput, KeyboardDoneAccessory, OTP_ACCESSORY_ID } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { maskPhone } from '@/lib/phone';
import { ApiError } from '@/lib/api';
import { colors, space } from '@/theme';

export default function OtpScreen() {
  const { pendingPhone, confirmOtp, sendOtp } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(30);

  useEffect(() => {
    if (!pendingPhone) {
      router.replace('/(auth)/phone');
    }
  }, [pendingPhone]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (code.length === 6) {
      void onVerify(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function onVerify(value: string) {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await confirmOtp(value);
      router.replace('/(auth)/pin-setup');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Invalid code');
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    if (!pendingPhone || resendIn > 0) return;
    setError(null);
    try {
      await sendOtp(pendingPhone);
      setResendIn(30);
      setCode('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not resend');
    }
  }

  return (
    <Screen>
      <View style={styles.content}>
        <Text variant="caption" color={colors.accent}>
          Step 2 of 3
        </Text>
        <Text variant="h1" style={styles.title}>
          Enter the code
        </Text>
        <Text variant="secondary" style={styles.sub}>
          Sent to {pendingPhone ? maskPhone(pendingPhone) : 'your phone'}
        </Text>
        <OtpInput value={code} onChange={setCode} autoFocus />
        {error ? (
          <Text variant="caption" color={colors.error} style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Pressable onPress={onResend} disabled={resendIn > 0} style={styles.resend}>
          <Text variant="bodyMedium" color={resendIn > 0 ? colors.textMuted : colors.accent}>
            {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
          </Text>
        </Pressable>
      </View>
      <Button
        label="Verify"
        fullWidth
        loading={loading}
        disabled={code.length < 6}
        onPress={() => onVerify(code)}
        style={styles.cta}
      />
      <KeyboardDoneAccessory nativeID={OTP_ACCESSORY_ID} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { marginTop: space.lg, gap: space.sm, flex: 1 },
  title: { marginTop: space.xs },
  sub: { marginBottom: space.md },
  error: { marginTop: space.sm },
  resend: { marginTop: space.lg, alignSelf: 'flex-start' },
  cta: { marginBottom: space.lg },
});
