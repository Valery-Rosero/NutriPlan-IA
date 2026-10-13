/**
 * Error de dominio con un código estable. Las capas de datos traducen cualquier error externo
 * (Postgres, Supabase Auth, red) a un AppError; la UI solo muestra el texto i18n `errors.<code>`.
 */
export const ERROR_CODES = [
  // reglas de la base (raise exception 'codigo: texto')
  'consent_required', 'adult_required', 'health_disclaimer_required', 'sensitive_authorization_required',
  'allergen_conflict', 'diet_conflict', 'slot_mismatch', 'choice_blocked', 'too_many_choices', 'too_few_choices',
  'not_eligible', 'region_required', 'plan_not_found', 'meal_not_found', 'meal_not_pending',
  'undo_window_expired', 'already_rated', 'consent_outdated', 'plan_overlap_confirmed',
  'invalid_quantity', 'unit_incompatible', 'no_eligible_recipes', 'invalid_days',
  // autenticación
  'invalid_credentials', 'email_not_confirmed', 'email_taken', 'weak_password', 'rate_limited',
  'link_expired', 'signup_failed', 'too_many_attempts',
  // transversales
  'network', 'unknown',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly cause?: unknown;

  constructor(code: ErrorCode, cause?: unknown) {
    super(code);
    this.name = 'AppError';
    this.code = code;
    this.cause = cause;
  }
}

function isErrorCode(value: string): value is ErrorCode {
  return (ERROR_CODES as readonly string[]).includes(value);
}

function messageOf(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return '';
}

/** Traduce cualquier error a un AppError (nunca expone el texto crudo). */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const message = messageOf(error);
  if (/network request failed|failed to fetch|fetch failed/i.test(message)) return new AppError('network', error);
  const code = message.split(':')[0]?.trim() ?? '';
  return new AppError(isErrorCode(code) ? code : 'unknown', error);
}

export function errorKey(error: unknown) {
  return `errors.${toAppError(error).code}` as const;
}
