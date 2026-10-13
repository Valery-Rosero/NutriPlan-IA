// Nada de salud, alergias, dietas ni datos personales en logs (AGENTS.md regla 5).
const SENSITIVE_KEYS = /allerg|diet|health|condition|weight|height|birth|email|name|phone|token|password/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, SENSITIVE_KEYS.test(k) ? '[redactado]' : redact(v, depth + 1)]),
  );
}

export const logger = {
  info: (event: string, data?: Record<string, unknown>) => {
    if (__DEV__) console.info(event, data ? redact(data) : '');
  },
  // Solo el código estable del error, nunca su texto completo (puede incluir datos).
  error: (event: string, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(event, message.split(':')[0]);
  },
};
