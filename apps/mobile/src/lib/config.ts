import { Platform } from 'react-native';
import Constants from 'expo-constants';

function expoLanHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    // Expo Go / older manifests
    (Constants as { linkingUri?: string }).linkingUri?.replace(/^[a-z]+:\/\//, '');
  const host = hostUri?.split(':')[0]?.replace(/\/$/, '') ?? null;
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  return host;
}

/**
 * Resolve Nest API base URL for Expo Go / simulators.
 * Physical devices cannot use localhost — that is the phone itself.
 */
export function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  const lan = expoLanHost();

  if (fromEnv) {
    const isLoopback = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:|\/|$)/i.test(
      fromEnv,
    );
    if (isLoopback && lan) {
      return fromEnv.replace(/localhost|127\.0\.0\.1/gi, lan);
    }
    return fromEnv;
  }

  if (lan) return `http://${lan}:3000`;

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }

  return 'http://localhost:3000';
}

export const API_BASE_URL = resolveApiBaseUrl();
export const APP_NAME = 'NovaPay';
