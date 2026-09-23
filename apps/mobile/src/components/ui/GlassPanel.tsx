import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radii, shadows, space } from '@/theme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** dark glass on navy backgrounds */
  tone?: 'light' | 'dark';
  padded?: boolean;
  depth?: boolean;
};

/** Frosted panel for premium fintech surfaces */
export function GlassPanel({
  children,
  style,
  tone = 'light',
  padded = true,
  depth = true,
}: Props) {
  const dark = tone === 'dark';
  return (
    <View
      style={[
        styles.wrap,
        dark ? styles.dark : styles.light,
        depth && shadows.depth,
        padded && styles.padded,
        style,
      ]}
    >
      <LinearGradient
        colors={
          dark
            ? ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.04)']
            : ['rgba(255,255,255,0.95)', 'rgba(232,238,245,0.65)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.shine, dark && styles.shineDark]} pointerEvents="none" />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  light: {
    backgroundColor: colors.glassFill,
    borderColor: colors.glassBorder,
  },
  dark: {
    backgroundColor: colors.glassDark,
    borderColor: colors.glassDarkBorder,
  },
  padded: { padding: space.md },
  content: { gap: space.sm },
  shine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  shineDark: { backgroundColor: 'rgba(255,255,255,0.22)' },
});
