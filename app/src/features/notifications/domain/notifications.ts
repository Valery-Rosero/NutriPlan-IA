/**
 * US-148/149/153: qué avisos recibe la persona. La base decide cuándo enviarlos; la app solo guarda la
 * preferencia y registra el teléfono. Los textos nunca llevan datos de salud.
 */
export type NotificationFrequency = 'daily' | 'weekly_summary' | 'none';

export type NotificationPreferences = {
  frequency: NotificationFrequency;
  /** Minutos antes de cada comida (US-148); la cena de las 20:00 con 30 → aviso a las 19:30. */
  leadMinutes: number;
  /** Aviso de lo que vence en 2 días, con una receta real (US-153). */
  expiryAlerts: boolean;
};

export const LEAD_OPTIONS = [15, 30, 60] as const;

/** Resultado de pedir el permiso y registrar el teléfono. */
export type PushRegistration =
  | { status: 'granted'; token: string }
  | { status: 'denied' }
  /** Expo Go o la app sin vincular a EAS: el push solo funciona en la app instalada (APK). */
  | { status: 'unavailable' };

/** Puerto de las preferencias y el registro del teléfono. Falla con AppError. */
export interface NotificationsRepository {
  preferences(): Promise<NotificationPreferences>;
  savePreferences(prefs: NotificationPreferences): Promise<void>;
  registerDevice(token: string): Promise<void>;
  unregisterDevice(token: string): Promise<void>;
}

/** Puerto del sistema de notificaciones del teléfono (expo-notifications). */
export interface PushPort {
  /** Pide el permiso EN CONTEXTO (al activar los avisos, nunca al abrir la app) y obtiene el token. */
  register(): Promise<PushRegistration>;
  /** ¿Ya hay permiso? Sin pedirlo. */
  isGranted(): Promise<boolean>;
}
