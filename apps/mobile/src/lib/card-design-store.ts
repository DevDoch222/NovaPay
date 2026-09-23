import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { CardDesignId } from './card-designs';

const KEY = 'novapay.cardDesigns';
const memory = new Map<string, string>();

async function readRaw(): Promise<Record<string, CardDesignId>> {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web') {
      raw = globalThis.localStorage?.getItem(KEY) ?? memory.get(KEY) ?? null;
    } else {
      raw = await SecureStore.getItemAsync(KEY);
    }
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CardDesignId>;
  } catch {
    return {};
  }
}

async function writeRaw(map: Record<string, CardDesignId>) {
  const value = JSON.stringify(map);
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(KEY, value);
    } catch {
      memory.set(KEY, value);
    }
    return;
  }
  await SecureStore.setItemAsync(KEY, value);
}

export async function getCardDesignId(cardId: string): Promise<CardDesignId | null> {
  const map = await readRaw();
  return map[cardId] ?? null;
}

export async function setCardDesignId(cardId: string, designId: CardDesignId) {
  const map = await readRaw();
  map[cardId] = designId;
  await writeRaw(map);
}

export async function getAllCardDesignIds(): Promise<Record<string, CardDesignId>> {
  return readRaw();
}
