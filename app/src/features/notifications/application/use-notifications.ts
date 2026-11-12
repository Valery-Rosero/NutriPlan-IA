import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useServices } from '@/di/services';
import type { NotificationPreferences } from '@/features/notifications/domain/notifications';

const TOKEN_KEY = 'nutriplan-push-token';

export const notificationKeys = {
  all: ['notifications'] as const,
  preferences: () => [...notificationKeys.all, 'preferences'] as const,
  granted: () => [...notificationKeys.all, 'granted'] as const,
};

export function useNotificationPreferences() {
  const { notifications } = useServices();
  return useQuery({ queryKey: notificationKeys.preferences(), queryFn: () => notifications.preferences() });
}

export function useSaveNotificationPreferences() {
  const { notifications } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prefs: NotificationPreferences) => notifications.savePreferences(prefs),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.preferences() }),
  });
}

/** ¿Este teléfono ya dio permiso? (sin pedirlo). */
export function usePushGranted() {
  const { push } = useServices();
  return useQuery({ queryKey: notificationKeys.granted(), queryFn: () => push.isGranted() });
}

/**
 * Pide el permiso EN CONTEXTO (al tocar "Activar avisos") y registra el teléfono en la base.
 * Devuelve el resultado para que la pantalla explique qué pasó (sin permiso, o solo en la app instalada).
 */
export function useEnablePush() {
  const { push, notifications } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await push.register();
      if (result.status === 'granted') {
        await notifications.registerDevice(result.token);
        await AsyncStorage.setItem(TOKEN_KEY, result.token).catch(() => undefined);
      }
      return result;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.granted() }),
  });
}

/** Al cerrar sesión, este teléfono deja de recibir los avisos de esa cuenta. Nunca bloquea el cierre. */
export function useUnregisterPush() {
  const { notifications } = useServices();
  return async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) {
        await notifications.unregisterDevice(token);
        await AsyncStorage.removeItem(TOKEN_KEY);
      }
    } catch {
      // sin conexión: la base lo limpiará cuando Expo informe que el token ya no sirve
    }
  };
}
