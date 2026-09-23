import React from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors, shadows } from '@/theme';

type Props = {
  uri?: string | null;
  name?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function UserAvatar({ uri, name, size = 64, style }: Props) {
  const initials = (name ?? 'NP').replace(/^@/, '').slice(0, 2).toUpperCase();
  const radius = size / 2;

  return (
    <View
      style={[
        styles.shell,
        shadows.depth,
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderWidth: size >= 90 ? 3 : 2,
        },
        style,
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: radius }}
          accessibilityLabel="Profile photo"
        />
      ) : (
        <Text
          variant={size >= 90 ? 'h2' : 'bodyMedium'}
          color={colors.primary}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderColor: colors.primarySoft,
  },
});
