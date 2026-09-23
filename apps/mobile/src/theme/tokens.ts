/**
 * NovaPay design tokens — fintech calm: navy trust + precise blue accent.
 * Matches UI/UX Design Description (July 2026).
 */
export const colors = {
  primary: '#0D2B4E',
  primaryMuted: '#163A63',
  primarySoft: '#E8EEF5',
  accent: '#1A73C1',
  accentSoft: '#E3F0FA',
  success: '#1E9E5A',
  successSoft: '#E6F6EE',
  warning: '#E0A314',
  warningSoft: '#FFF6E0',
  error: '#D64545',
  errorSoft: '#FBEAEA',
  background: '#F7F9FB',
  backgroundElevated: '#F0F4F8',
  surface: '#FFFFFF',
  surfaceBorder: '#E5EBF2',
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  textOnPrimary: '#FFFFFF',
  textMuted: '#9AA3AF',
  overlay: 'rgba(13, 43, 78, 0.48)',
  hairline: '#D8E0EA',
  glassFill: 'rgba(255,255,255,0.72)',
  glassBorder: 'rgba(255,255,255,0.55)',
  glassDark: 'rgba(13, 43, 78, 0.55)',
  glassDarkBorder: 'rgba(255,255,255,0.18)',
} as const;

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 28,
  full: 999,
} as const;

export const shadows = {
  card: {
    shadowColor: '#0D2B4E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  sheet: {
    shadowColor: '#0D2B4E',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 12,
  },
  depth: {
    shadowColor: '#0D2B4E',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 10,
  },
  glowSuccess: {
    shadowColor: '#1E9E5A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;

export const tapTarget = 44;
