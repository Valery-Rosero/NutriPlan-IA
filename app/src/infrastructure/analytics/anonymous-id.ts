import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

const KEY = 'nutriplan-anonymous-id';
let cached: string | null = null;

/**
 * Identificador anónimo generado en el dispositivo (US-131): aleatorio, sin relación con la cuenta.
 * Sobrevive entre sesiones para contar dispositivos, no personas; se pierde al reinstalar la app.
 */
export async function anonymousId(): Promise<string> {
  if (cached) return cached;
  try {
    cached = (await AsyncStorage.getItem(KEY)) ?? randomUUID();
    await AsyncStorage.setItem(KEY, cached);
  } catch {
    cached ??= randomUUID();
  }
  return cached;
}
