import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  Text,
  Button,
  TextField,
  UserAvatar,
  KeyboardDoneAccessory,
  FORM_ACCESSORY_ID,
} from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { ApiError } from '@/lib/api';
import { colors, space } from '@/theme';

const accessoryId = Platform.OS === 'ios' ? FORM_ACCESSORY_ID : undefined;

export default function EditProfileScreen() {
  const { user, unlocked, updateProfile } = useAuth();
  const [tag, setTag] = useState(user?.tag?.replace(/^@/, '') ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    user?.avatarUrl ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);

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

  async function pickPhoto() {
    setPicking(true);
    setError(null);
    try {
      // Lazy import so a bad/missing package doesn't crash the whole app boot
      const ImagePicker = await import('expo-image-picker');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Photos',
          'Allow photo access in Settings so you can set a profile picture.',
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.55,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (!asset.base64) {
        setError('Could not read that photo — try another image');
        return;
      }
      const mime = asset.mimeType?.includes('png')
        ? 'image/png'
        : asset.mimeType?.includes('webp')
          ? 'image/webp'
          : 'image/jpeg';
      const dataUrl = `data:${mime};base64,${asset.base64}`;
      if (dataUrl.length > 380_000) {
        setError('Photo is too large — try a smaller crop');
        return;
      }
      setAvatarUrl(dataUrl);
    } catch (e) {
      const msg =
        e instanceof Error && /Unable to resolve|Cannot find module/i.test(e.message)
          ? 'Photo picker isn’t available — restart Expo with cache clear'
          : 'Could not open photo library';
      setError(msg);
    } finally {
      setPicking(false);
    }
  }

  async function save() {
    const cleaned = tag.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z][a-z0-9_]{2,23}$/.test(cleaned)) {
      setError('Username: 3–24 chars, start with a letter, use letters/numbers/_');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: { tag?: string; avatarUrl?: string | null } = {};
      if (cleaned !== (user?.tag ?? '').toLowerCase()) body.tag = cleaned;
      if (avatarUrl !== (user?.avatarUrl ?? null)) body.avatarUrl = avatarUrl;
      if (!Object.keys(body).length) {
        router.back();
        return;
      }
      await updateProfile(body);
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text variant="bodyMedium" color={colors.accent}>
              Cancel
            </Text>
          </Pressable>
          <Text variant="h3">Edit profile</Text>
          <View style={{ width: 56 }} />
        </View>

        <View style={styles.body}>
          <Pressable style={styles.avatarWrap} onPress={() => void pickPhoto()}>
            <UserAvatar uri={avatarUrl} name={cleanedPreview(tag)} size={112} />
            <View style={styles.cameraBadge}>
              {picking ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="camera" size={16} color="#fff" />
              )}
            </View>
          </Pressable>
          <Text variant="caption" color={colors.textMuted} style={styles.hint}>
            Tap photo to change
          </Text>

          <TextField
            label="Username"
            value={tag}
            onChangeText={setTag}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="yourname"
            inputAccessoryViewID={accessoryId}
          />
          <Text variant="caption" color={colors.textMuted}>
            Shown as @{cleanedPreview(tag) || 'username'}
          </Text>

          {avatarUrl ? (
            <Button
              label="Remove photo"
              variant="ghost"
              onPress={() => setAvatarUrl(null)}
            />
          ) : null}

          {error ? (
            <Text variant="caption" color={colors.error}>
              {error}
            </Text>
          ) : null}
        </View>

        <Button
          label={saving ? 'Saving…' : 'Save changes'}
          fullWidth
          loading={saving}
          onPress={() => void save()}
          style={styles.cta}
        />
        <KeyboardDoneAccessory nativeID={FORM_ACCESSORY_ID} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

function cleanedPreview(tag: string) {
  return tag.trim().replace(/^@/, '').toLowerCase();
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
    marginBottom: space.lg,
  },
  body: { flex: 1, gap: space.sm },
  avatarWrap: {
    alignSelf: 'center',
    marginTop: space.md,
  },
  cameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  hint: { textAlign: 'center', marginBottom: space.md },
  cta: { marginBottom: space.lg },
});
