import React from 'react';
import {
  TextInput,
  View,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Text } from './Text';
import { colors, radii, space, typography } from '@/theme';

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  containerStyle?: ViewStyle;
};

export function TextField({
  label,
  error,
  containerStyle,
  style,
  ...rest
}: Props) {
  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? (
        <Text variant="caption" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...rest}
        style={[styles.input, error ? styles.inputError : null, style]}
      />
      {error ? (
        <Text variant="caption" color={colors.error} style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  label: { color: colors.textSecondary },
  input: {
    ...typography.body,
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: space.md,
    color: colors.text,
  },
  inputError: { borderColor: colors.error },
  error: { marginTop: 2 },
});
