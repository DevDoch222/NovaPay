import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { AuthUser } from './types';

const KEYS = {
  access: 'novapay.accessToken',
  refresh: 'novapay.refreshToken',
  user: 'novapay.user',
  pin: 'novapay.pin',
  pinSalt: 'novapay.pinSalt',
  biometrics: 'novapay.biometrics',
  kycSkipped: 'novapay.kycSkipped',
} as const;

const memory = new Map<string, string>();

async function set(key: string, value: string) {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      memory.set(key, value);
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function get(key: string) {
  if (Platform.OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(key) ?? memory.get(key) ?? null;
    } catch {
      return memory.get(key) ?? null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function del(key: string) {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* ignore */
    }
    memory.delete(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function saveSession(input: {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}) {
  await Promise.all([
    set(KEYS.access, input.accessToken),
    set(KEYS.refresh, input.refreshToken),
    set(KEYS.user, JSON.stringify(input.user)),
  ]);
}

export async function loadSession(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
} | null> {
  const [accessToken, refreshToken, userRaw] = await Promise.all([
    get(KEYS.access),
    get(KEYS.refresh),
    get(KEYS.user),
  ]);
  if (!accessToken && !refreshToken) return null;
  let user: AuthUser | null = null;
  if (userRaw) {
    try {
      user = JSON.parse(userRaw) as AuthUser;
    } catch {
      user = null;
    }
  }
  return { accessToken, refreshToken, user };
}

export async function clearSession() {
  await Promise.all([
    del(KEYS.access),
    del(KEYS.refresh),
    del(KEYS.user),
    del(KEYS.kycSkipped),
  ]);
}

export async function savePin(pin: string) {
  await set(KEYS.pin, pin);
}

export async function getPin() {
  return get(KEYS.pin);
}

export async function savePinSalt(salt: string) {
  await set(KEYS.pinSalt, salt);
}

export async function getPinSalt() {
  return get(KEYS.pinSalt);
}

export async function clearPin() {
  await Promise.all([del(KEYS.pin), del(KEYS.pinSalt)]);
}

export async function setBiometricsEnabled(enabled: boolean) {
  await set(KEYS.biometrics, enabled ? '1' : '0');
}

export async function getBiometricsEnabled() {
  return (await get(KEYS.biometrics)) === '1';
}

export async function setKycSkipped(skipped: boolean) {
  if (skipped) await set(KEYS.kycSkipped, '1');
  else await del(KEYS.kycSkipped);
}

export async function getKycSkipped() {
  return (await get(KEYS.kycSkipped)) === '1';
}
