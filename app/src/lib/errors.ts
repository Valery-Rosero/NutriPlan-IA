// Las funciones de la base lanzan 'codigo: texto'. La app solo muestra el texto i18n del código, nunca el crudo.
const KNOWN_CODES = [
  'consent_required', 'adult_required', 'health_disclaimer_required', 'sensitive_authorization_required',
  'allergen_conflict', 'diet_conflict', 'slot_mismatch', 'choice_blocked', 'too_many_choices', 'too_few_choices',
  'not_eligible', 'region_required', 'plan_not_found', 'meal_not_found', 'meal_not_pending',
  'undo_window_expired', 'already_rated', 'consent_outdated', 'plan_overlap_confirmed',
  'invalid_quantity', 'unit_incompatible',
] as const;

export type ErrorCode = (typeof KNOWN_CODES)[number] | 'signup_failed' | 'network' | 'unknown';

function messageOf(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return '';
}

export function errorCode(error: unknown): ErrorCode {
  const message = messageOf(error);
  // Supabase Auth oculta el error del trigger de registro detrás de un mensaje genérico.
  if (/database error saving new user/i.test(message)) return 'signup_failed';
  if (/network request failed|failed to fetch|fetch failed/i.test(message)) return 'network';
  const code = message.split(':')[0]?.trim() ?? '';
  return (KNOWN_CODES as readonly string[]).includes(code) ? (code as ErrorCode) : 'unknown';
}

export function errorKey(error: unknown) {
  return `errors.${errorCode(error)}` as const;
}
