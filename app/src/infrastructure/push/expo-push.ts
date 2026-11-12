import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';

import type { PushPort, PushRegistration } from '@/features/notifications/domain/notifications';

const CHANNEL = 'default'; // el mismo que usa send-notifications y el plugin (app.json)

/** Adaptador de expo-notifications (SDK 57). Único lugar de la app que conoce esa librería. */
export const expoPush: PushPort = {
  async register(): Promise<PushRegistration> {
    // En Expo Go (Android, SDK 53+) no hay push remoto; sin projectId de EAS no hay token.
    const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient || !projectId) return { status: 'unavailable' };

    // Android 13+: el canal debe existir antes de pedir el permiso, o el diálogo no aparece.
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Recordatorios de comidas',
      importance: Notifications.AndroidImportance.HIGH,
    });
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return { status: 'denied' };

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { status: 'granted', token: data };
  },

  async isGranted() {
    try {
      return (await Notifications.getPermissionsAsync()).granted;
    } catch {
      return false;
    }
  },
};

/** Con la app abierta, el aviso también se muestra (si no, Android lo descarta en primer plano). */
export function configureForegroundNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
