import * as Notifications from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

/** Solo rutas internas de la app (las arma la base: /recipe/…, /week). Nada externo. */
const isInternal = (url: unknown): url is string => typeof url === 'string' && url.startsWith('/') && !url.startsWith('//');

/**
 * Tocar un aviso abre lo que anuncia: la receta de esa comida o la semana. Cubre la app abierta y el
 * arranque desde el aviso (cuando estaba cerrada). Solo se activa cuando la persona ya está en la app.
 */
export function useNotificationTaps(enabled: boolean) {
  const router = useRouter();
  const last = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!enabled || !last || last.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const url = last.notification.request.content.data?.url;
    if (isInternal(url)) router.push(url as Href);
  }, [enabled, last, router]);
}
