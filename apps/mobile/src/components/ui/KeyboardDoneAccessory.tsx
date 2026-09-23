import React from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from './Text';
import { colors, space } from '@/theme';

export const PHONE_ACCESSORY_ID = 'novapay-phone-done';
export const OTP_ACCESSORY_ID = 'novapay-otp-done';
export const PIN_ACCESSORY_ID = 'novapay-pin-done';
export const FORM_ACCESSORY_ID = 'novapay-form-done';

type Props = {
  nativeID: string;
};

/** iOS number pads have no Done key — this toolbar dismisses the keyboard. */
export function KeyboardDoneAccessory({ nativeID }: Props) {
  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={nativeID}>
      <View style={styles.bar}>
        <Pressable
          onPress={Keyboard.dismiss}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Dismiss keyboard"
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        >
          <Text variant="bodyMedium" color={colors.accent}>
            Done
          </Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.backgroundElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  btn: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  pressed: { opacity: 0.7 },
});
