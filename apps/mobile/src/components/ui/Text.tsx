import React from 'react';
import {
  Text as RNText,
  TextProps as RNTextProps,
  StyleSheet,
} from 'react-native';
import { typography } from '@/theme';

type Variant = keyof typeof typography;

type Props = RNTextProps & {
  variant?: Variant;
  color?: string;
};

export function Text({
  variant = 'body',
  color,
  style,
  children,
  ...rest
}: Props) {
  return (
    <RNText
      {...rest}
      style={[typography[variant], color ? { color } : null, style]}
      allowFontScaling
      maxFontSizeMultiplier={1.3}
    >
      {children}
    </RNText>
  );
}

/** Convenience for balances — always tabular numerals */
export function MoneyText({
  children,
  size = 'lg',
  color,
  style,
  ...rest
}: Omit<Props, 'variant'> & { size?: 'lg' | 'md' | 'sm' }) {
  const variant =
    size === 'lg' ? 'moneyLg' : size === 'md' ? 'moneyMd' : 'moneySm';
  return (
    <Text variant={variant} color={color} style={style} {...rest}>
      {children}
    </Text>
  );
}

export const textStyles = StyleSheet.create({});
