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

/** Lo que el navegador raíz necesita de las puertas una vez decididas. */
export type DecidedGates = { signedIn: boolean; mustConsent: boolean; mustOnboard: boolean; inApp: boolean };

/**
 * Puertas que se muestran: las de ahora si ya están decididas; si se están recalculando (cambió la sesión y las
 * consultas de arranque cargan de nuevo), las últimas decididas. Así el navegador, una vez montado, no se cambia
 * por el splash ni vuelve a empezar: el enlace de "recuperar contraseña" abre la sesión y se queda en
 * "Nueva contraseña". `null` solo antes de la primera decisión (splash).
 */
export function holdGates(gates: Gates, hasSession: boolean, last: DecidedGates | null): DecidedGates | null {
  if (!gates.ready) return last;
  const now = { signedIn: hasSession, mustConsent: gates.mustConsent, mustOnboard: gates.mustOnboard, inApp: gates.inApp };
  return last && sameGates(now, last) ? last : now;
}

function sameGates(a: DecidedGates, b: DecidedGates) {
  return a.signedIn === b.signedIn && a.mustConsent === b.mustConsent && a.mustOnboard === b.mustOnboard && a.inApp === b.inApp;
}
