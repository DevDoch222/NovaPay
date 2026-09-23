import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export type BiometricKind = 'face' | 'fingerprint' | 'iris' | 'none';

export async function getBiometricKind(): Promise<BiometricKind> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  // Numeric fallbacks match AuthenticationType enum (SDK 54)
  const face =
    LocalAuthentication.AuthenticationType?.FACIAL_RECOGNITION ?? 2;
  const finger =
    LocalAuthentication.AuthenticationType?.FINGERPRINT ?? 1;
  const iris = LocalAuthentication.AuthenticationType?.IRIS ?? 3;
  if (types.includes(face)) return 'face';
  if (types.includes(finger)) return 'fingerprint';
  if (types.includes(iris)) return 'iris';
  return 'none';
}

export function biometricLabel(kind: BiometricKind): string {
  if (kind === 'face') {
    return Platform.OS === 'ios' ? 'Face ID' : 'Face unlock';
  }
  if (kind === 'fingerprint') {
    return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
  }
  if (kind === 'iris') return 'Iris';
  return 'Biometrics';
}

export async function canUseBiometrics(): Promise<{
  available: boolean;
  kind: BiometricKind;
  label: string;
  reason?: string;
}> {
  const kind = await getBiometricKind();
  const label = biometricLabel(kind);
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) {
    return {
      available: false,
      kind,
      label,
      reason: 'This device has no Face ID or fingerprint sensor',
    };
  }
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) {
    return {
      available: false,
      kind,
      label,
      reason: `Set up ${label} in your device Settings first`,
    };
  }
  return { available: true, kind, label };
}

let promptLock: Promise<unknown> | null = null;

/**
 * Prompt Face ID / fingerprint.
 * Uses device-owner policy (Face ID with optional device-passcode fallback)
 * — biometrics-only policy is flaky in Expo Go.
 */
export async function promptBiometrics(promptMessage: string): Promise<{
  success: boolean;
  error?: string;
}> {
  while (promptLock) {
    try {
      await promptLock;
    } catch {
      /* previous attempt ended */
    }
  }

  const run = (async () => {
    const gate = await canUseBiometrics();
    if (!gate.available) {
      return { success: false as const, error: gate.reason ?? 'Biometrics unavailable' };
    }

    // Keep options minimal — disableDeviceFallback:true often returns
    // authentication_failed / unknown on iOS Expo Go.
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
      ...(Platform.OS === 'ios' ? { fallbackLabel: 'Use Passcode' } : {}),
      ...(Platform.OS === 'android'
        ? { biometricsSecurityLevel: 'weak' as const, requireConfirmation: false }
        : {}),
    });

    if (result.success) return { success: true as const };

    const err =
      'error' in result && result.error ? String(result.error) : 'unknown';
    const warning =
      'warning' in result && result.warning ? String(result.warning) : '';

    if (err === 'user_cancel' || err === 'system_cancel' || err === 'app_cancel') {
      return { success: false as const, error: undefined };
    }
    if (err === 'user_fallback') {
      // User chose device passcode path — treat as cancelled for app unlock (use app PIN)
      return {
        success: false as const,
        error: `Use your NovaPay PIN below`,
      };
    }
    if (err === 'not_enrolled' || err === 'passcode_not_set') {
      return {
        success: false as const,
        error: `Set up ${gate.label} in your device Settings first`,
      };
    }
    if (err === 'lockout') {
      return {
        success: false as const,
        error: `${gate.label} locked — wait a moment or use your PIN`,
      };
    }
    if (err === 'authentication_failed') {
      return {
        success: false as const,
        error: `${gate.label} didn’t match — try again or use your PIN`,
      };
    }
    if (err === 'not_available') {
      return {
        success: false as const,
        error: `${gate.label} isn’t available right now`,
      };
    }

    return {
      success: false as const,
      error:
        warning ||
        `${gate.label} couldn’t unlock (${err}). Use your PIN instead.`,
    };
  })();

  promptLock = run.finally(() => {
    promptLock = null;
  });
  return run;
}
