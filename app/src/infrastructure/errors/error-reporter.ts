import Constants from 'expo-constants';
import * as Device from 'expo-device';

import { createDeduper, toErrorReport } from '@/core/errors/scrub';
import { anonymousId } from '@/infrastructure/analytics/anonymous-id';
import { supabase } from '@/infrastructure/supabase/client';

const shouldSend = createDeduper(60_000);

/**
 * US-122: registra una falla en la base (report_app_error), limpia y sin datos de la persona.
 * Nunca lanza: reportar una falla no puede causar otra.
 */
export async function reportError(error: unknown, screen: string | null = null) {
  try {
    const r = toErrorReport(error, screen);
    if (!shouldSend(r)) return;
    await supabase.rpc('report_app_error', {
      p_error_name: r.name,
      p_message: r.message,
      p_stack: r.stack ?? undefined,
      p_screen: r.screen ?? undefined,
      p_app_version: Constants.expoConfig?.version ?? undefined,
      p_device_model: Device.modelName ?? undefined,
      p_anonymous_id: await anonymousId(),
    });
  } catch {
    // sin conexión o sin base: se pierde el reporte, no la app
  }
}

type GlobalHandler = (error: Error, isFatal?: boolean) => void;
type ErrorUtilsLike = { getGlobalHandler: () => GlobalHandler; setGlobalHandler: (h: GlobalHandler) => void };

/** Errores JS no controlados (fuera de React): se reportan y siguen al manejador original. */
export function installGlobalErrorHandler() {
  const utils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!utils) return;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    void reportError(error, isFatal ? 'fatal' : 'global');
    previous(error, isFatal);
  });
}
