import * as Crypto from 'expo-crypto';

const PIN_VERSION = 'v1';

export async function hashPin(pin: string, salt: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${PIN_VERSION}:${salt}:${pin}`,
  );
  return `${PIN_VERSION}:${digest}`;
}

export async function createPinSalt(): Promise<string> {
  return Crypto.getRandomBytesAsync(16).then((bytes) =>
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
  );
}

export function isHashedPin(stored: string): boolean {
  return stored.startsWith(`${PIN_VERSION}:`);
}
