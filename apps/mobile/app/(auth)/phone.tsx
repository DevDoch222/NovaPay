import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Keyboard,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import {
  Screen,
  Text,
  Button,
  TextField,
  KeyboardDoneAccessory,
  PHONE_ACCESSORY_ID,
} from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { toE164 } from '@/lib/phone';
import { ApiError } from '@/lib/api';
import { colors, space } from '@/theme';

export default function PhoneScreen() {
  const { sendOtp } = useAuth();
  const [phone, setPhone] = useState('+234');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onContinue() {
    Keyboard.dismiss();
    setError(null);
    const e164 = toE164(phone);
    if (!e164) {
      setError('Enter a valid phone in international format, e.g. +2348012345678');
      return;
    }
    setLoading(true);
    try {
      await sendOtp(e164);
      router.push('/(auth)/otp');
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Could not send code. Is the API running and reachable from this phone?',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Text variant="caption" color={colors.accent}>
              Step 1 of 3
            </Text>
            <Text variant="h1" style={styles.title}>
              Your phone number
            </Text>
            <Text variant="secondary" style={styles.sub}>
              We’ll text a one-time code. Use your primary mobile — this becomes
              your NovaPay login.
            </Text>
            <TextField
              label="Phone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              autoFocus
              error={error}
              placeholder="+2348012345678"
              inputAccessoryViewID={
                Platform.OS === 'ios' ? PHONE_ACCESSORY_ID : undefined
              }
              blurOnSubmit
              onSubmitEditing={onContinue}
            />
          </View>

          <Pressable onPress={Keyboard.dismiss} style={styles.spacer} />

          <Button
            label="Send code"
            fullWidth
            loading={loading}
            onPress={onContinue}
            style={styles.cta}
          />
        </ScrollView>
      </KeyboardAvoidingView>
      <KeyboardDoneAccessory nativeID={PHONE_ACCESSORY_ID} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingBottom: space.lg,
  },
  content: { marginTop: space.lg, gap: space.sm },
  title: { marginTop: space.xs },
  sub: { marginBottom: space.md },
  spacer: { flexGrow: 1, minHeight: space.lg },
  cta: { marginTop: space.md },
});
