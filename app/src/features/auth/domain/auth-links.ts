/**
 * Enlaces de correo de Supabase (verificar cuenta, recuperar contraseña).
 *
 * Supabase devuelve a la app con `?code=…` (PKCE) a la dirección pedida (`nutriplan://reset-password`,
 * `nutriplan://auth-callback`). Pero si esa dirección no está en la lista permitida del proyecto, usa la
 * principal (`nutriplan://`) y la app abría "donde se había quedado", sin canjear el código.
 * Esta regla manda el código a la pantalla correcta llegue por donde llegue.
 */

/** Cuánto vale la marca de "pedí recuperar la contraseña" (el enlace de Supabase vence en 1 h). */
export const RECOVERY_WINDOW_MS = 2 * 60 * 60 * 1000;

const AUTH_ROUTES = new Set(['reset-password', 'auth-callback']);

/** Pantalla de la dirección, sin esquema ni parámetros: "nutriplan://reset-password?x" → "reset-password". */
export function routeOf(path: string): string {
  const withoutQuery = path.split(/[?#]/, 1)[0];
  const withoutScheme = withoutQuery.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  // Expo Go: exp://192.168.0.5:8081/--/reset-password
  const route = withoutScheme.includes('/--/') ? withoutScheme.split('/--/').pop()! : withoutScheme;
  return route.replace(/^\/+|\/+$/g, '');
}

/** Parámetros de la consulta y del fragmento (Supabase puede mandar errores en cualquiera de los dos). */
export function authParams(path: string): string {
  const query = path.includes('?') ? path.slice(path.indexOf('?') + 1).split('#')[0] : '';
  const hash = path.includes('#') ? path.slice(path.indexOf('#') + 1) : '';
  return [query, hash].filter(Boolean).join('&');
}

function hasAuthParams(params: string) {
  return params.split('&').some((p) => /^(code|error_code|error)=/.test(p));
}

/**
 * A dónde debe ir un enlace entrante. Devuelve `null` si no hay que tocarlo (no es de autenticación, o ya
 * apunta a su pantalla). Con código y sin pantalla correcta: "Nueva contraseña" si hay una recuperación
 * pedida hace poco; si no, la verificación de la cuenta.
 */
export function authLinkTarget(path: string, recoveryPending: boolean): string | null {
  const params = authParams(path);
  if (!hasAuthParams(params)) return null;
  if (AUTH_ROUTES.has(routeOf(path))) return null;
  return `${recoveryPending ? '/reset-password' : '/auth-callback'}?${params}`;
}

/** ¿La marca de recuperación sigue vigente? */
export function isRecoveryPending(requestedAt: number | null, now: number): boolean {
  return requestedAt !== null && now - requestedAt >= 0 && now - requestedAt < RECOVERY_WINDOW_MS;
}
