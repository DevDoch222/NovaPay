import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { colors, radii, space } from '@/theme';

type Tone = 'success' | 'warning' | 'error' | 'neutral' | 'info';

const tones: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  error: { bg: colors.errorSoft, fg: colors.error },
  neutral: { bg: colors.backgroundElevated, fg: colors.textSecondary },
  info: { bg: colors.accentSoft, fg: colors.accent },
};

type Props = {
  label: string;
  tone?: Tone;
};

export function StatusPill({ label, tone = 'neutral' }: Props) {
  const t = tones[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      <Text variant="caption" color={t.fg}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
    borderRadius: radii.full,
  },
});
