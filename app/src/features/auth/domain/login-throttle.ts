/**
 * Freno local de intentos de inicio de sesión (US-104: 5 fallos → 15 min).
 * La protección real son los límites de Supabase Auth (ADR-019); esto evita que la app
 * siga golpeando el servidor y le dice a la persona cuánto esperar. Reloj inyectable para pruebas.
 */
export type LoginThrottleOptions = { maxAttempts?: number; lockMs?: number; now?: () => number };

export function createLoginThrottle({ maxAttempts = 5, lockMs = 15 * 60_000, now = Date.now }: LoginThrottleOptions = {}) {
  const failures = new Map<string, { count: number; lockedUntil: number }>();
  const key = (email: string) => email.trim().toLowerCase();

  return {
    /** Milisegundos que faltan para poder intentar de nuevo (0 = libre). */
    remainingLockMs(email: string) {
      const entry = failures.get(key(email));
      return entry ? Math.max(0, entry.lockedUntil - now()) : 0;
    },
    recordFailure(email: string) {
      const k = key(email);
      const prev = failures.get(k);
      const lockExpired = prev !== undefined && prev.lockedUntil !== 0 && prev.lockedUntil <= now();
      const count = (prev && !lockExpired ? prev.count : 0) + 1;
      failures.set(k, { count, lockedUntil: count >= maxAttempts ? now() + lockMs : 0 });
    },
    recordSuccess(email: string) {
      failures.delete(key(email));
    },
  };
}

export type LoginThrottle = ReturnType<typeof createLoginThrottle>;
