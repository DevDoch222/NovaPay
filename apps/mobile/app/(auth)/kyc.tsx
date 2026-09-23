import React, { useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Screen, Text, Button, TextField, StatusPill } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { ApiError } from '@/lib/api';
import { colors, radii, space } from '@/theme';

const DOC_TYPES = [
  { id: 'NIN', label: 'National ID (NIN)', hint: '11-digit number' },
  { id: 'PASSPORT', label: 'Passport', hint: 'International travel document' },
  { id: 'DRIVERS_LICENSE', label: 'Driver’s license', hint: 'Government-issued' },
] as const;

type Step = 'type' | 'details' | 'selfie' | 'review' | 'done';

export default function KycScreen() {
  const { completeKyc, skipKyc, user } = useAuth();
  const [step, setStep] = useState<Step>('type');
  const [documentType, setDocumentType] = useState<string>('NIN');
  const [documentNumber, setDocumentNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState('');

  const stepIndex =
    step === 'type' ? 1 : step === 'details' ? 2 : step === 'selfie' ? 3 : 4;

  async function onSubmit() {
    setError(null);
    if (documentNumber.trim().length < 5) {
      setError('Document number looks too short');
      return;
    }
    setLoading(true);
    try {
      const result = await completeKyc({
        documentType,
        documentNumber: documentNumber.trim(),
        fullName: fullName.trim() || undefined,
      });
      setResultMessage(result.message);
      setStep('done');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'KYC submit failed');
    } finally {
      setLoading(false);
    }
  }

  async function onSkip() {
    await skipKyc();
    router.replace('/(tabs)');
  }

  return (
    <Screen scroll>
      <Text variant="caption" color={colors.accent} style={styles.eyebrow}>
        Verification · Step {Math.min(stepIndex, 4)} of 4
      </Text>
      <View style={styles.progress}>
        {[1, 2, 3, 4].map((n) => (
          <View
            key={n}
            style={[styles.bar, n <= stepIndex ? styles.barOn : null]}
          />
        ))}
      </View>

      {step === 'type' ? (
        <View style={styles.block}>
          <Text variant="h1">Choose an ID</Text>
          <Text variant="secondary" style={styles.sub}>
            Unlock higher send limits. An ops agent reviews your ID — no auto-approve.
          </Text>
          {DOC_TYPES.map((d) => (
            <Pressable
              key={d.id}
              onPress={() => setDocumentType(d.id)}
              style={[
                styles.option,
                documentType === d.id && styles.optionOn,
              ]}
            >
              <Text variant="bodyMedium">{d.label}</Text>
              <Text variant="caption">{d.hint}</Text>
            </Pressable>
          ))}
          <Button label="Continue" fullWidth onPress={() => setStep('details')} />
          <Button label="Skip for now" variant="ghost" fullWidth onPress={onSkip} />
        </View>
      ) : null}

      {step === 'details' ? (
        <View style={styles.block}>
          <Text variant="h1">Your details</Text>
          <Text variant="secondary" style={styles.sub}>
            Match the name printed on your {documentType.replace('_', ' ')}.
          </Text>
          <TextField
            label="Full legal name"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            placeholder="Ada Lovelace"
          />
          <TextField
            label="Document number"
            value={documentNumber}
            onChangeText={setDocumentNumber}
            autoCapitalize="characters"
            placeholder={documentType === 'NIN' ? '12345678901' : 'A12345678'}
            error={error}
          />
          <Button
            label="Continue"
            fullWidth
            onPress={() => {
              setError(null);
              if (documentNumber.trim().length < 5) {
                setError('Enter a valid document number');
                return;
              }
              setStep('selfie');
            }}
          />
          <Button label="Back" variant="ghost" fullWidth onPress={() => setStep('type')} />
        </View>
      ) : null}

      {step === 'selfie' ? (
        <View style={styles.block}>
          <Text variant="h1">Quick selfie</Text>
          <Text variant="secondary" style={styles.sub}>
            In production this can include a selfie. For now we file your ID for
            manual review.
          </Text>
          <View style={styles.cameraFrame}>
            <View style={styles.oval} />
            <Text variant="caption" color="rgba(255,255,255,0.75)">
              Position your face in the oval
            </Text>
          </View>
          <Button label="Capture & continue" fullWidth onPress={() => setStep('review')} />
          <Button label="Back" variant="ghost" fullWidth onPress={() => setStep('details')} />
        </View>
      ) : null}

      {step === 'review' ? (
        <View style={styles.block}>
          <Text variant="h1">Review & submit</Text>
          <Text variant="secondary" style={styles.sub}>
            Confirm everything looks correct before we file your verification.
          </Text>
          <View style={styles.reviewRow}>
            <Text variant="caption">Account</Text>
            <Text variant="bodyMedium">{user?.tag ? `@${user.tag}` : user?.phone}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text variant="caption">Document</Text>
            <Text variant="bodyMedium">{documentType}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text variant="caption">Number</Text>
            <Text variant="bodyMedium">{documentNumber}</Text>
          </View>
          {fullName ? (
            <View style={styles.reviewRow}>
              <Text variant="caption">Name</Text>
              <Text variant="bodyMedium">{fullName}</Text>
            </View>
          ) : null}
          {error ? (
            <Text variant="caption" color={colors.error}>
              {error}
            </Text>
          ) : null}
          <Button
            label="Submit verification"
            fullWidth
            loading={loading}
            onPress={onSubmit}
          />
          <Button label="Back" variant="ghost" fullWidth onPress={() => setStep('selfie')} />
        </View>
      ) : null}

      {step === 'done' ? (
        <View style={styles.block}>
          <StatusPill
            label={resultMessage.toLowerCase().includes('auto') ? 'Approved' : 'In review'}
            tone={resultMessage.toLowerCase().includes('auto') ? 'success' : 'info'}
          />
          <Text variant="h1" style={styles.doneTitle}>
            {resultMessage.toLowerCase().includes('auto')
              ? 'You’re verified'
              : 'Submitted for review'}
          </Text>
          <Text variant="secondary">
            {resultMessage || 'KYC submitted. Limits will update shortly.'}
          </Text>
          <Button
            label="Go to Home"
            fullWidth
            onPress={() => router.replace('/(tabs)')}
            style={styles.doneCta}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { marginTop: space.sm },
  progress: {
    flexDirection: 'row',
    gap: space.xs,
    marginTop: space.sm,
    marginBottom: space.lg,
  },
  bar: {
    flex: 1,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.hairline,
  },
  barOn: { backgroundColor: colors.accent },
  block: { gap: space.md, paddingBottom: space.xxl },
  sub: { marginBottom: space.xs },
  option: {
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: space.md,
    gap: 4,
  },
  optionOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  cameraFrame: {
    height: 280,
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    marginVertical: space.sm,
  },
  oval: {
    width: 160,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    borderStyle: 'dashed',
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  doneTitle: { marginTop: space.sm },
  doneCta: { marginTop: space.lg },
});
