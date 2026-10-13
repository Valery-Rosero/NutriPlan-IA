/**
 * Máquina de estados del onboarding (US-106 a US-109, US-130). Pura y probada aparte de la UI.
 * hogar → autorización de datos sensibles → restricciones (solo si autorizó) → presupuesto → listo
 */
export type OnboardingStep = 'household' | 'sensitive' | 'restrictions' | 'budget' | 'done';

export type OnboardingState = { step: OnboardingStep; sensitiveAuthorized: boolean };

export type OnboardingEvent =
  | { type: 'household_saved' }
  | { type: 'sensitive_decided'; authorized: boolean }
  | { type: 'restrictions_saved' }
  | { type: 'budget_saved' }
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
    default:
      return step;
  }
}

export const ONBOARDING_STEPS: OnboardingStep[] = ['household', 'sensitive', 'restrictions', 'budget'];

/** Posición para el indicador "Paso 2 de 4". */
export function stepNumber(step: OnboardingStep) {
  return Math.max(1, ONBOARDING_STEPS.indexOf(step) + 1);
}
