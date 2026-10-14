import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import { Appearance } from 'react-native';

/** Tema elegido por la persona. "system" sigue el ajuste del teléfono. Se guarda solo en este dispositivo. */
export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'nutriplan-theme';

/** Aplica el tema a TODA la app: useColorScheme() devuelve el elegido en cualquier pantalla. */
export function applyThemePreference(preference: ThemePreference) {
  Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
}

export async function loadThemePreference(): Promise<ThemePreference> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

/** Al abrir la app: recupera y aplica lo que la persona eligió la última vez. */
export async function restoreThemePreference() {
  applyThemePreference(await loadThemePreference());
}

export function useThemePreference(initial: ThemePreference = 'system') {
  const [preference, setPreference] = useState<ThemePreference>(initial);
  const choose = (next: ThemePreference) => {
    setPreference(next);
    applyThemePreference(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined); // si falla, el tema igual cambia en esta sesión
  };
  return { preference, choose, setPreference };
}
