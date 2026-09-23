import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ViewStyle,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space } from '@/theme';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
};

export function Screen({
  children,
  scroll,
  style,
  edges = ['top'],
}: Props) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, style]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, style]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.wash} pointerEvents="none" />
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  wash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: colors.primarySoft,
    opacity: 0.55,
  },
  content: {
    flex: 1,
    paddingHorizontal: space.md,
  },
  scrollContent: {
    paddingHorizontal: space.md,
    paddingBottom: space.xxl,
    flexGrow: 1,
  },
});
