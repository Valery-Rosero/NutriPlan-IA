/**
 * Máquina de estados del onboarding (US-106 a US-109, US-130). Pura y probada aparte de la UI.
 * hogar → autorización de datos sensibles → restricciones (solo si autorizó) → presupuesto → qué hay en la cocina → listo
 * El último paso es el que hace útil la app desde el primer minuto: las recetas dependen de lo que hay (ADR-024).
 */
export type OnboardingStep = 'household' | 'sensitive' | 'restrictions' | 'budget' | 'kitchen' | 'done';

export type OnboardingState = { step: OnboardingStep; sensitiveAuthorized: boolean };

export type OnboardingEvent =
  | { type: 'household_saved' }
  | { type: 'sensitive_decided'; authorized: boolean }
  | { type: 'restrictions_saved' }
  | { type: 'budget_saved' }
  | { type: 'kitchen_done' }
  | { type: 'back' };

export const initialOnboarding = (sensitiveAuthorized: boolean): OnboardingState => ({ step: 'household', sensitiveAuthorized });

export function onboardingReducer(state: OnboardingState, event: OnboardingEvent): OnboardingState {
  switch (event.type) {
    case 'household_saved':
      return { ...state, step: 'sensitive' };
    case 'sensitive_decided':
      // Sin autorización no se pueden guardar alergias ni dietas: se salta ese paso (ADR-011).
      return { step: event.authorized ? 'restrictions' : 'budget', sensitiveAuthorized: event.authorized };
    case 'restrictions_saved':
      return { ...state, step: 'budget' };
    case 'budget_saved':
      return { ...state, step: 'kitchen' };
    case 'kitchen_done':
      return { ...state, step: 'done' };
    case 'back':
      return { ...state, step: previousStep(state) };
  }
}

function previousStep({ step, sensitiveAuthorized }: OnboardingState): OnboardingStep {
  switch (step) {
    case 'sensitive':
      return 'household';
    case 'restrictions':
      return 'sensitive';
    case 'budget':
      return sensitiveAuthorized ? 'restrictions' : 'sensitive';
    case 'kitchen':
      return 'budget';
    default:
      return step;
  }
}

export const ONBOARDING_STEPS: OnboardingStep[] = ['household', 'sensitive', 'restrictions', 'budget', 'kitchen'];

/** Posición para el indicador "Paso 2 de 4". */
export function stepNumber(step: OnboardingStep) {
  return Math.max(1, ONBOARDING_STEPS.indexOf(step) + 1);
}
