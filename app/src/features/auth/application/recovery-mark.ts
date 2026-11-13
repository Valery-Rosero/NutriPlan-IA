import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Marca local "esta persona pidió recuperar su contraseña" (solo la hora; ningún dato personal).
 * Sirve para saber a qué pantalla mandar un código de Supabase que llegó sin dirección (ver auth-links.ts).
 * Nunca rompe el flujo: si el almacenamiento falla, se sigue sin la marca.
 */
const KEY = 'nutriplan-recovery-requested-at';

export async function markRecoveryRequested(now = Date.now()) {
  await AsyncStorage.setItem(KEY, String(now)).catch(() => undefined);
}

export async function readRecoveryMark(): Promise<number | null> {
  const value = await AsyncStorage.getItem(KEY).catch(() => null);
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export async function clearRecoveryMark() {
  await AsyncStorage.removeItem(KEY).catch(() => undefined);
}
