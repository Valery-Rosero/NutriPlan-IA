/**
 * Puertas de arranque, en orden: sin sesión → acceso; documentos por aceptar → consentimientos;
 * onboarding sin terminar → onboarding; si no → la app. Función pura: el navegador raíz solo la consulta.
 */
export type GateInput = {
  hasSession: boolean;
  sessionLoading: boolean;
  fontsReady: boolean;
  online: boolean;
  consents: { pending: boolean; error: boolean; success: boolean; toAccept: number };
  profile: { pending: boolean; error: boolean; success: boolean; onboarded: boolean };
};

export type Gates = {
  /** Se puede quitar el splash: ya se sabe a dónde ir. */
  ready: boolean;
  mustConsent: boolean;
  mustOnboard: boolean;
  inApp: boolean;
  /** Entró sin conexión con lo guardado en el teléfono; al volver la red se revalida todo. */
  offlineStart: boolean;
};

export function computeGates(i: GateInput): Gates {
  const { hasSession, consents, profile } = i;
  const mustConsent = hasSession && (consents.error || consents.toAccept > 0);
  const consentsOk = hasSession && consents.success && !mustConsent;
  const mustOnboard = consentsOk && profile.success && !profile.onboarded;
  // US-150: sin red, las consultas de arranque quedan EN PAUSA (no fallan): sin esto, splash para siempre.
  // Con sesión se entra a la app con la caché (plan y lista, ADR-014); la base sigue exigiendo todo al volver la red.
  const offlineStart = hasSession && !i.online && (consents.pending || (consentsOk && profile.pending));
  const inApp = (consentsOk && profile.success && !mustOnboard) || (consentsOk && profile.error) || offlineStart;
  const decided = !hasSession || mustConsent || (consentsOk && !profile.pending) || profile.error || offlineStart;
  return { ready: i.fontsReady && !i.sessionLoading && decided, mustConsent, mustOnboard, inApp, offlineStart };
}
