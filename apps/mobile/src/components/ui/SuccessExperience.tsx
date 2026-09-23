import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Text, MoneyText } from './Text';
import { Button } from './Button';
import { GlassPanel } from './GlassPanel';
import { colors, shadows, space } from '@/theme';

type Meta = { label: string; value: string };

type Props = {
  badge?: string;
  title: string;
  subtitle?: string;
  amount?: string;
  amountCurrency?: string;
  meta?: Meta[];
  primaryLabel?: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

/** Premium completion state — animated mark, glass summary, clear CTAs */
export function SuccessExperience({
  badge = 'Successful',
  title,
  subtitle,
  amount,
  amountCurrency,
  meta,
  primaryLabel = 'Done',
  onPrimary,
  secondaryLabel,
  onSecondary,
}: Props) {
  const ring = useSharedValue(0.82);

  useEffect(() => {
    ring.value = withDelay(120, withSpring(1, { damping: 12, stiffness: 140 }));
  }, [ring]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ring.value }],
  }));

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#E8EEF5', '#F7F9FB', '#E3F0FA']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.orbTop} pointerEvents="none" />
      <View style={styles.orbBottom} pointerEvents="none" />

      <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.hero}>
        <Animated.View style={[styles.ringOuter, shadows.glowSuccess, ringStyle]}>
          <LinearGradient
            colors={['#2BB673', '#1E9E5A', '#157A45']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ringInner}
          >
            <Ionicons name="checkmark" size={42} color="#fff" />
          </LinearGradient>
        </Animated.View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).springify()} style={styles.copy}>
        <Text variant="caption" color={colors.success} style={styles.badge}>
          {badge.toUpperCase()}
        </Text>
        <Text variant="h1" style={styles.title}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="secondary" style={styles.sub}>
            {subtitle}
          </Text>
        ) : null}
      </Animated.View>

      {(amount || (meta && meta.length > 0)) && (
        <Animated.View entering={FadeInDown.delay(220).springify()} style={styles.panelWrap}>
          <GlassPanel depth>
            {amount ? (
              <View style={styles.amountBlock}>
                <Text variant="caption" color={colors.textSecondary}>
                  Amount
                </Text>
                {amountCurrency ? (
                  <MoneyText size="lg">{amount}</MoneyText>
                ) : (
                  <Text variant="h1">{amount}</Text>
                )}
              </View>
            ) : null}
            {meta?.map((row) => (
              <View key={row.label} style={styles.metaRow}>
                <Text variant="caption" color={colors.textSecondary}>
                  {row.label}
                </Text>
                <Text variant="bodyMedium" style={styles.metaValue}>
                  {row.value}
                </Text>
              </View>
            ))}
          </GlassPanel>
        </Animated.View>
      )}

      <Animated.View entering={FadeIn.delay(360)} style={styles.actions}>
        <Button label={primaryLabel} fullWidth onPress={onPrimary} />
        {secondaryLabel && onSecondary ? (
          <Pressable onPress={onSecondary} style={styles.secondary}>
            <Text variant="bodyMedium" color={colors.accent}>
              {secondaryLabel}
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: space.md,
    paddingBottom: space.xl,
    justifyContent: 'center',
  },
  orbTop: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(26,115,193,0.12)',
  },
  orbBottom: {
    position: 'absolute',
    bottom: 80,
    left: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(30,158,90,0.08)',
  },
  hero: {
    alignItems: 'center',
    marginBottom: space.lg,
  },
  ringOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  ringInner: {
    flex: 1,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { alignItems: 'center', gap: space.xs, marginBottom: space.lg },
  badge: { letterSpacing: 1.2, fontWeight: '600' },
  title: { textAlign: 'center' },
  sub: { textAlign: 'center', maxWidth: 320 },
  panelWrap: { marginBottom: space.lg },
  amountBlock: { alignItems: 'center', gap: space.xxs, marginBottom: space.xs },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  metaValue: { flex: 1, textAlign: 'right' },
  actions: { gap: space.md },
  secondary: { alignItems: 'center', paddingVertical: space.sm },
});
