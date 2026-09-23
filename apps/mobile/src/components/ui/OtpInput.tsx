import React, { useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
  Platform,
} from 'react-native';
import { colors, radii, space, typography } from '@/theme';
import { OTP_ACCESSORY_ID, PIN_ACCESSORY_ID } from './KeyboardDoneAccessory';

type Props = {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
};

export function OtpInput({
  length = 6,
  value,
  onChange,
  autoFocus,
}: Props) {
  const refs = useRef<Array<TextInput | null>>([]);
  const digits = value.padEnd(length, ' ').slice(0, length).split('');
  const accessoryId =
    Platform.OS === 'ios'
      ? length === 4
        ? PIN_ACCESSORY_ID
        : OTP_ACCESSORY_ID
      : undefined;

  function setAt(index: number, char: string) {
    const next = digits.map((d, i) => (i === index ? char : d === ' ' ? '' : d));
    const joined = next.join('').replace(/\s/g, '').slice(0, length);
    onChange(joined);
    if (char && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  function onKeyPress(
    index: number,
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) {
    if (e.nativeEvent.key === 'Backspace' && !digits[index]?.trim() && index > 0) {
      refs.current[index - 1]?.focus();
      setAt(index - 1, '');
    }
  }

  return (
    <View style={styles.row}>
      {Array.from({ length }).map((_, i) => (
        <Pressable
          key={i}
          onPress={() => refs.current[i]?.focus()}
          style={[styles.cell, digits[i]?.trim() ? styles.filled : null]}
        >
          <TextInput
            ref={(r) => {
              refs.current[i] = r;
            }}
            value={digits[i]?.trim() ?? ''}
            onChangeText={(t) => {
              const char = t.replace(/\D/g, '').slice(-1);
              setAt(i, char);
            }}
            onKeyPress={(e) => onKeyPress(i, e)}
            keyboardType="number-pad"
            textContentType={length === 6 ? 'oneTimeCode' : 'none'}
            autoComplete={length === 6 ? 'sms-otp' : 'off'}
            maxLength={1}
            autoFocus={autoFocus && i === 0}
            style={styles.input}
            selectionColor={colors.accent}
            inputAccessoryViewID={accessoryId}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.xs,
  },
  cell: {
    flex: 1,
    height: 56,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: {
    borderColor: colors.accent,
  },
  input: {
    ...typography.h2,
    width: '100%',
    textAlign: 'center',
    color: colors.text,
  },
});
