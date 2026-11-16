import { computeGates, holdGates, type GateInput } from '@/core/startup/gates';

const base: GateInput = {
  hasSession: true,
  sessionLoading: false,
  fontsReady: true,
  online: true,
  consents: { pending: false, error: false, success: true, toAccept: 0 },
  profile: { pending: false, error: false, success: true, onboarded: true },
};
const pendingConsents = { pending: true, error: false, success: false, toAccept: 0 };
const pendingProfile = { pending: true, error: false, success: false, onboarded: false };

describe('puertas de arranque', () => {
  it('sin sesión: listo para ir al acceso', () => {
    expect(computeGates({ ...base, hasSession: false, consents: pendingConsents })).toMatchObject({ ready: true, inApp: false });
  });

  it('con documentos por aceptar: consentimientos', () => {
    expect(computeGates({ ...base, consents: { ...base.consents, toAccept: 1 } })).toMatchObject({ ready: true, mustConsent: true, inApp: false });
  });

  it('onboarding sin terminar: onboarding', () => {
    expect(computeGates({ ...base, profile: { ...base.profile, onboarded: false } })).toMatchObject({ mustOnboard: true, inApp: false });
  });

  it('todo en orden: la app', () => {
    expect(computeGates(base)).toMatchObject({ ready: true, inApp: true, offlineStart: false });
  });

  it('con red y consultas en camino: espera en el splash (aún no sabe a dónde ir)', () => {
    expect(computeGates({ ...base, consents: pendingConsents }).ready).toBe(false);
  });

  it('US-150: sin red al abrir no se queda en el splash: entra con lo guardado', () => {
    const g = computeGates({ ...base, online: false, consents: pendingConsents, profile: pendingProfile });
    expect(g).toMatchObject({ ready: true, inApp: true, offlineStart: true });
  });

  it('sin red y sin sesión: va al acceso (que dirá que no hay conexión)', () => {
    expect(computeGates({ ...base, hasSession: false, online: false, consents: pendingConsents })).toMatchObject({ ready: true, inApp: false, offlineStart: false });
  });

  it('espera las fuentes y la sesión guardada antes de decidir', () => {
    expect(computeGates({ ...base, fontsReady: false }).ready).toBe(false);
    expect(computeGates({ ...base, sessionLoading: true }).ready).toBe(false);
  });
});

describe('puertas mientras se recalculan (el navegador no se desmonta)', () => {
  const signedOut = computeGates({ ...base, hasSession: false, consents: pendingConsents });

  it('antes de la primera decisión: nada que mostrar (splash)', () => {
    expect(holdGates(computeGates({ ...base, sessionLoading: true }), false, null)).toBeNull();
  });

  it('el enlace de recuperar contraseña abre la sesión: mientras carga, se quedan las de antes', () => {
    const before = holdGates(signedOut, false, null);
    expect(before).toEqual({ signedIn: false, mustConsent: false, mustOnboard: false, inApp: false });
    // Con sesión nueva, consentimientos y perfil vuelven a cargar: no está decidido.
    const loading = computeGates({ ...base, consents: pendingConsents, profile: pendingProfile });
    expect(loading.ready).toBe(false);
    expect(holdGates(loading, true, before)).toBe(before); // mismo objeto: no se vuelve al splash
  });

  it('cuando decide, pasa a las nuevas; si no cambian, conserva el mismo objeto', () => {
    const before = holdGates(signedOut, false, null);
    const after = holdGates(computeGates(base), true, before);
    expect(after).toEqual({ signedIn: true, mustConsent: false, mustOnboard: false, inApp: true });
    expect(holdGates(computeGates(base), true, after)).toBe(after);
  });
});
