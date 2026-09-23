import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import {
  Screen,
  Text,
  Button,
  TextField,
  SuccessExperience,
  KeyboardDoneAccessory,
  FORM_ACCESSORY_ID,
} from '@/components/ui';
import { CardFace, CardDesignPicker } from '@/components/cards/CardFace';
import { ConfirmSecureAction } from '@/components/auth/ConfirmSecureAction';
import { useAuth } from '@/auth/AuthContext';
import { useWallets } from '@/wallets/WalletsContext';
import type { CardForm, IssueCardInput, NovaCard } from '@/lib/cards-api';
import { formatFulfillmentStatus } from '@/lib/cards-api';
import type { CardDesignId } from '@/lib/card-designs';
import { setCardDesignId } from '@/lib/card-design-store';
import { formatMoney } from '@/lib/money';
import { ApiError } from '@/lib/api';
import { colors, radii, space } from '@/theme';

type Step = 'form' | 'auth' | 'done';

const accessoryId = Platform.OS === 'ios' ? FORM_ACCESSORY_ID : undefined;

function FormToggle({
  value,
  onChange,
}: {
  value: CardForm;
  onChange: (f: CardForm) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      {(['virtual', 'physical'] as const).map((option) => {
        const selected = value === option;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.toggleChip, selected && styles.toggleChipOn]}
          >
            <Text
              variant="bodyMedium"
              color={selected ? colors.text : colors.textSecondary}
            >
              {option === 'virtual' ? 'Virtual' : 'Physical'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function CreateCardScreen() {
  const { user, unlocked, authFetch } = useAuth();
  const { walletFor, refresh } = useWallets();
  const [form, setForm] = useState<CardForm>('virtual');
  const [label, setLabel] = useState('');
  const [limit, setLimit] = useState('100');
  const [designId, setDesignId] = useState<CardDesignId>('harbor');
  const [shippingName, setShippingName] = useState('');
  const [shippingLine1, setShippingLine1] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingCountry, setShippingCountry] = useState('NG');
  const [shippingPostal, setShippingPostal] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<NovaCard | null>(null);

  const usd = walletFor('USD');

  useEffect(() => {
    if (!user || !unlocked) router.replace('/');
  }, [user, unlocked]);

  if (!user || !unlocked) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />
      </Screen>
    );
  }

  const previewCard: NovaCard = {
    id: 'preview',
    brand: 'visa',
    last4: '4821',
    expMonth: '12',
    expYear: '2029',
    status: 'active',
    form,
    currency: 'USD',
    walletId: '',
    spendLimitMinor: null,
    label: label.trim() || 'NovaPay',
    fulfillmentStatus: form === 'physical' ? 'pending_print' : null,
    shipping: null,
    processorRef: '',
    createdAt: new Date().toISOString(),
  };

  function validateForm(): string | null {
    const spendLimitMajor = Number(limit);
    if (!Number.isFinite(spendLimitMajor) || spendLimitMajor < 1) {
      return 'Enter a per-auth spend limit of at least $1';
    }
    if (form === 'physical') {
      if (shippingName.trim().length < 2) return 'Enter the name for delivery';
      if (shippingLine1.trim().length < 3) return 'Enter street address';
      if (shippingCity.trim().length < 2) return 'Enter city';
      const country = shippingCountry.trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(country)) {
        return 'Country must be a 2-letter code (e.g. NG, US)';
      }
      if (shippingPostal.trim().length < 2) return 'Enter postal / ZIP code';
    }
    return null;
  }

  function goToAuth() {
    const msg = validateForm();
    if (msg) {
      setError(msg);
      return;
    }
    setError(null);
    setStep('auth');
  }

  async function issue() {
    setLoading(true);
    setError(null);
    try {
      const spendLimitMajor = Number(limit);
      const body: IssueCardInput = {
        form,
        label: label.trim() || undefined,
        spendLimitMajor: Math.floor(spendLimitMajor),
      };
      if (form === 'physical') {
        body.shippingName = shippingName.trim();
        body.shippingLine1 = shippingLine1.trim();
        body.shippingCity = shippingCity.trim();
        body.shippingCountry = shippingCountry.trim().toUpperCase();
        body.shippingPostal = shippingPostal.trim();
      }
      const card = await authFetch<NovaCard>('/v1/cards', {
        method: 'POST',
        body,
      });
      await setCardDesignId(card.id, designId);
      setCreated(card);
      await refresh();
      setStep('done');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not issue card');
      setStep('form');
    } finally {
      setLoading(false);
    }
  }

  const title = form === 'physical' ? 'New physical card' : 'New virtual card';

  return (
    <Screen edges={['top', 'bottom']} style={{ paddingHorizontal: 0 }}>
      {step !== 'done' ? (
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text variant="bodyMedium" color={colors.accent}>
              Close
            </Text>
          </Pressable>
          <Text variant="h3">{title}</Text>
          <View style={{ width: 48 }} />
        </View>
      ) : null}

      {step === 'form' ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <FormToggle value={form} onChange={setForm} />

            <CardFace card={previewCard} designId={designId} showStatus={false} />
            <CardDesignPicker value={designId} onChange={setDesignId} />

            <Text variant="secondary">
              {form === 'virtual'
                ? 'Instant virtual card funded from your USD wallet. Only the last four digits are shown — the full PAN stays with the issuer.'
                : 'We print and ship a physical Visa to your address. It spends from the same USD wallet once activated. Delivery is simulated in sandbox.'}
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              USD available{' '}
              {usd ? formatMoney(usd.balanceMinor, 'USD') : '$0.00'}
            </Text>

            <TextField
              label="Nickname (optional)"
              value={label}
              onChangeText={setLabel}
              placeholder="Travel, SaaS, ..."
              inputAccessoryViewID={accessoryId}
            />
            <TextField
              label="Per-auth spend limit (USD)"
              value={limit}
              onChangeText={(t) => setLimit(t.replace(/[^\d]/g, '').slice(0, 6))}
              placeholder="100"
              keyboardType="number-pad"
              inputAccessoryViewID={accessoryId}
            />

            {form === 'physical' ? (
              <View style={styles.shippingBlock}>
                <Text variant="h3">Delivery address</Text>
                <TextField
                  label="Full name"
                  value={shippingName}
                  onChangeText={setShippingName}
                  placeholder="Ada Okonkwo"
                  autoCapitalize="words"
                  inputAccessoryViewID={accessoryId}
                />
                <TextField
                  label="Street address"
                  value={shippingLine1}
                  onChangeText={setShippingLine1}
                  placeholder="12 Broad Street"
                  inputAccessoryViewID={accessoryId}
                />
                <TextField
                  label="City"
                  value={shippingCity}
                  onChangeText={setShippingCity}
                  placeholder="Lagos"
                  inputAccessoryViewID={accessoryId}
                />
                <View style={styles.shippingRow}>
                  <View style={styles.shippingHalf}>
                    <TextField
                      label="Country"
                      value={shippingCountry}
                      onChangeText={(t) =>
                        setShippingCountry(t.replace(/[^a-zA-Z]/g, '').slice(0, 2))
                      }
                      placeholder="NG"
                      autoCapitalize="characters"
                      inputAccessoryViewID={accessoryId}
                    />
                  </View>
                  <View style={styles.shippingHalf}>
                    <TextField
                      label="Postal code"
                      value={shippingPostal}
                      onChangeText={setShippingPostal}
                      placeholder="100001"
                      inputAccessoryViewID={accessoryId}
                    />
                  </View>
                </View>
              </View>
            ) : null}

            {error ? (
              <Text variant="caption" color={colors.error}>
                {error}
              </Text>
            ) : null}

            <Button label="Continue" fullWidth onPress={goToAuth} />
          </ScrollView>
          <KeyboardDoneAccessory nativeID={FORM_ACCESSORY_ID} />
        </KeyboardAvoidingView>
      ) : null}

      {step === 'auth' ? (
        <View style={styles.body}>
          <ConfirmSecureAction
            title="Authorize card"
            subtitle={
              form === 'physical'
                ? 'Confirm with PIN or biometrics to order your physical card.'
                : 'Confirm with PIN or biometrics to issue this virtual card.'
            }
            busy={loading}
            onCancel={() => setStep('form')}
            onSuccess={issue}
          />
        </View>
      ) : null}

      {step === 'done' && created ? (
        <SuccessExperience
          badge={form === 'physical' ? 'Order placed' : 'Card issued'}
          title={
            form === 'physical' ? 'Your card is on the way' : 'Your card is ready'
          }
          subtitle={`•••• ${created.last4} · ${created.brand.toUpperCase()}`}
          meta={[
            {
              label: 'Type',
              value: form === 'physical' ? 'Physical USD' : 'Virtual USD',
            },
            ...(form === 'physical' && created.fulfillmentStatus
              ? [
                  {
                    label: 'Status',
                    value: formatFulfillmentStatus(created.fulfillmentStatus),
                  },
                ]
              : [{ label: 'Design', value: designId }]),
            {
              label: 'Expires',
              value: `${created.expMonth}/${created.expYear.slice(-2)}`,
            },
          ]}
          primaryLabel="View card"
          onPrimary={() =>
            router.replace({
              pathname: '/card-details',
              params: { id: created.id },
            })
          }
          secondaryLabel="Back to cards"
          onSecondary={() => router.replace('/(tabs)/cards')}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
    marginBottom: space.lg,
    paddingHorizontal: space.md,
  },
  body: {
    flexGrow: 1,
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.xl,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginBottom: space.xs,
  },
  toggleChip: {
    flex: 1,
    paddingVertical: space.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  toggleChipOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  shippingBlock: {
    gap: space.sm,
    marginTop: space.xs,
  },
  shippingRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  shippingHalf: {
    flex: 1,
  },
});
