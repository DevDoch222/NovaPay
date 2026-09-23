import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import {
  Screen,
  Text,
  Button,
  TextField,
  BottomSheet,
  KeyboardDoneAccessory,
  FORM_ACCESSORY_ID,
} from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import {
  SANDBOX_NG_BANKS,
  type Beneficiary,
} from '@/lib/fx-send-api';
import { ApiError } from '@/lib/api';
import { colors, radii, space } from '@/theme';

type Kind = 'bank' | 'mobile_money';

const MOMO = [
  { id: 'mtn', label: 'MTN MoMo' },
  { id: 'airtel', label: 'Airtel Money' },
  { id: 'mpesa', label: 'M-Pesa' },
  { id: 'vodafone', label: 'Vodafone Cash' },
] as const;

const accessoryId = Platform.OS === 'ios' ? FORM_ACCESSORY_ID : undefined;

export default function AddBeneficiaryScreen() {
  const { user, unlocked, authFetch } = useAuth();
  const [kind, setKind] = useState<Kind>('bank');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [label, setLabel] = useState('');
  const [bankCode, setBankCode] = useState<string>(SANDBOX_NG_BANKS[0].code);
  const [bankName, setBankName] = useState<string>(SANDBOX_NG_BANKS[0].name);
  const [provider, setProvider] = useState<(typeof MOMO)[number]['id']>('mtn');
  const [bankSheet, setBankSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  async function onSave() {
    Keyboard.dismiss();
    if (accountName.trim().length < 2) {
      setError('Enter the account name');
      return;
    }
    if (accountNumber.trim().length < 6) {
      setError('Enter a valid account / wallet number');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const created = await authFetch<Beneficiary>('/v1/beneficiaries', {
        method: 'POST',
        body: {
          type: kind,
          accountName: accountName.trim(),
          accountNumber: accountNumber.trim(),
          label: label.trim() || undefined,
          country: 'NG',
          currency: 'NGN',
          ...(kind === 'bank' ? { bankCode, bankName } : { provider }),
        },
      });
      router.replace({
        pathname: '/send-money',
        params: { beneficiaryId: created.id },
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save recipient');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']} scroll={false} style={{ paddingHorizontal: 0 }}>
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
          <View style={styles.header}>
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                router.back();
              }}
              hitSlop={12}
            >
              <Text variant="bodyMedium" color={colors.accent}>
                Close
              </Text>
            </Pressable>
            <Text variant="h3">Add recipient</Text>
            <View style={{ width: 48 }} />
          </View>

          <View style={styles.seg}>
            {(['bank', 'mobile_money'] as Kind[]).map((k) => (
              <Pressable
                key={k}
                style={[styles.segItem, kind === k && styles.segOn]}
                onPress={() => {
                  Keyboard.dismiss();
                  setKind(k);
                }}
              >
                <Text
                  variant="caption"
                  color={kind === k ? colors.accent : colors.textSecondary}
                >
                  {k === 'bank' ? 'Bank' : 'Mobile money'}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextField
            label="Account name"
            value={accountName}
            onChangeText={setAccountName}
            autoCapitalize="words"
            placeholder="Chioma Okafor"
            returnKeyType="next"
            blurOnSubmit={false}
            inputAccessoryViewID={accessoryId}
          />
          <TextField
            label={kind === 'bank' ? 'Account number' : 'Wallet / phone number'}
            value={accountNumber}
            onChangeText={setAccountNumber}
            keyboardType="number-pad"
            placeholder={kind === 'bank' ? '0123456789' : '08012345678'}
            containerStyle={{ marginTop: space.md }}
            inputAccessoryViewID={accessoryId}
          />
          <TextField
            label="Label (optional)"
            value={label}
            onChangeText={setLabel}
            placeholder="Mum"
            containerStyle={{ marginTop: space.md }}
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={Keyboard.dismiss}
            inputAccessoryViewID={accessoryId}
          />

          {kind === 'bank' ? (
            <Pressable
              style={styles.picker}
              onPress={() => {
                Keyboard.dismiss();
                setBankSheet(true);
              }}
            >
              <Text variant="caption">Bank</Text>
              <Text variant="bodyMedium">
                {bankName} ({bankCode})
              </Text>
            </Pressable>
          ) : (
            <View style={styles.momoGrid}>
              {MOMO.map((m) => (
                <Pressable
                  key={m.id}
                  style={[styles.momoChip, provider === m.id && styles.momoOn]}
                  onPress={() => {
                    Keyboard.dismiss();
                    setProvider(m.id);
                  }}
                >
                  <Text
                    variant="caption"
                    color={
                      provider === m.id ? colors.accent : colors.textSecondary
                    }
                  >
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {error ? (
            <Text
              variant="caption"
              color={colors.error}
              style={{ marginTop: space.sm }}
            >
              {error}
            </Text>
          ) : null}

          <Button
            label="Save recipient"
            fullWidth
            loading={loading}
            style={{ marginTop: space.xl }}
            onPress={onSave}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <KeyboardDoneAccessory nativeID={FORM_ACCESSORY_ID} />

      <BottomSheet
        visible={bankSheet}
        onClose={() => setBankSheet(false)}
        title="Select bank"
      >
        {SANDBOX_NG_BANKS.map((b) => (
          <Pressable
            key={b.code}
            style={styles.bankRow}
            onPress={() => {
              setBankCode(b.code);
              setBankName(b.name);
              setBankSheet(false);
            }}
          >
            <Text variant="bodyMedium">{b.name}</Text>
            <Text variant="caption">{b.code}</Text>
          </Pressable>
        ))}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: space.md,
    paddingBottom: space.xxl,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
    marginBottom: space.lg,
  },
  seg: {
    flexDirection: 'row',
    gap: space.xs,
    marginBottom: space.lg,
  },
  segItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  segOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  picker: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
    gap: 4,
  },
  momoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    marginTop: space.md,
  },
  momoChip: {
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  momoOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  bankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
});
