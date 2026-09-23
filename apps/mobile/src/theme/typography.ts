import { TextStyle } from 'react-native';
import { colors } from './tokens';

/**
 * Plus Jakarta Sans — display / headings (modern fintech).
 * DM Sans — body + monetary numerals (clean, highly legible).
 */
export const fontFamilies = {
  display: 'PlusJakartaSans_600SemiBold',
  displayBold: 'PlusJakartaSans_700Bold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
  /** Prefer for money columns / balances */
  money: 'DMSans_500Medium',
} as const;

export const typography = {
  heroBrand: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.8,
    color: colors.text,
  } satisfies TextStyle,
  h1: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: colors.text,
  } satisfies TextStyle,
  h2: {
    fontFamily: fontFamilies.display,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
    color: colors.text,
  } satisfies TextStyle,
  h3: {
    fontFamily: fontFamilies.display,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
  } satisfies TextStyle,
  body: {
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  } satisfies TextStyle,
  bodyMedium: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  } satisfies TextStyle,
  secondary: {
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  } satisfies TextStyle,
  caption: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
    color: colors.textSecondary,
  } satisfies TextStyle,
  moneyLg: {
    fontFamily: fontFamilies.money,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
    color: colors.text,
  } satisfies TextStyle,
  moneyMd: {
    fontFamily: fontFamilies.money,
    fontSize: 18,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
    color: colors.text,
  } satisfies TextStyle,
  moneySm: {
    fontFamily: fontFamilies.money,
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
    color: colors.text,
  } satisfies TextStyle,
  button: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.1,
  } satisfies TextStyle,
  tabLabel: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
  } satisfies TextStyle,
} as const;
