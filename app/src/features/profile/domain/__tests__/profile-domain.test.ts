import {
  initialOnboarding,
  onboardingReducer,
  ONBOARDING_STEPS,
  stepNumber,
  type OnboardingEvent,
  type OnboardingState,
} from '@/features/profile/domain/onboarding';
import { budgetSchema, kcalTargetSchema, macroSplit, nextCookTime, parseCop } from '@/features/profile/domain/profile';

const run = (authorized: boolean, events: OnboardingEvent[]) => events.reduce(onboardingReducer, initialOnboarding(authorized));

describe('onboarding (máquina de estados)', () => {
  it('con autorización pasa por restricciones', () => {
    const state = run(false, [{ type: 'household_saved' }, { type: 'sensitive_decided', authorized: true }]);
    expect(state).toEqual({ step: 'restrictions', sensitiveAuthorized: true });
  });

  it('sin autorización salta las restricciones (ADR-011)', () => {
    const state = run(false, [{ type: 'household_saved' }, { type: 'sensitive_decided', authorized: false }]);
    expect(state.step).toBe('budget');
  });

  it('volver desde presupuesto respeta el camino tomado', () => {
    expect(run(false, [{ type: 'household_saved' }, { type: 'sensitive_decided', authorized: false }, { type: 'back' }]).step).toBe('sensitive');
    expect(
      run(false, [{ type: 'household_saved' }, { type: 'sensitive_decided', authorized: true }, { type: 'restrictions_saved' }, { type: 'back' }]).step,
    ).toBe('restrictions');
  });

  it('después del presupuesto pide preferencias y notificaciones, y termina en la cocina', () => {
    const afterBudget = run(true, [
      { type: 'household_saved' },
      { type: 'sensitive_decided', authorized: true },
      { type: 'restrictions_saved' },
      { type: 'budget_saved' },
    ]);
    expect(afterBudget.step).toBe('preferences');
    const afterPrefs = onboardingReducer(afterBudget, { type: 'preferences_saved' });
    expect(afterPrefs.step).toBe('notifications');
    const kitchen = onboardingReducer(afterPrefs, { type: 'notifications_done' });
    expect(kitchen.step).toBe('kitchen');
    expect(onboardingReducer(kitchen, { type: 'kitchen_done' }).step).toBe('done');
  });

  it('volver recorre los pasos nuevos en orden', () => {
    const back = (step: OnboardingState['step']) => onboardingReducer({ step, sensitiveAuthorized: false }, { type: 'back' }).step;
    expect(back('kitchen')).toBe('notifications');
    expect(back('notifications')).toBe('preferences');
    expect(back('preferences')).toBe('budget');
  });

  it('el avance cuenta siete pasos', () => {
    expect(ONBOARDING_STEPS).toHaveLength(7);
    expect(stepNumber('notifications')).toBe(6);
  });
});

describe('presupuesto (US-108)', () => {
  it('lee pesos con puntos de miles', () => {
    expect(parseCop('150.000')).toBe(150000);
    expect(parseCop('')).toBeNull();
  });

  it('monto y periodo van juntos; sin monto no hay periodo', () => {
    expect(budgetSchema.parse({ amount: 150000, period: 'week' })).toEqual({ budgetAmount: 150000, budgetPeriod: 'week' });
    expect(budgetSchema.parse({ amount: null, period: 'month' })).toEqual({ budgetAmount: null, budgetPeriod: null });
    expect(budgetSchema.safeParse({ amount: 0, period: 'week' }).success).toBe(false);
  });
});

describe('tiempo máximo de cocina (US-137)', () => {
  it('propone el siguiente límite y, después del mayor, quitarlo', () => {
    expect(nextCookTime(15)).toBe(20);
    expect(nextCookTime(20)).toBe(30);
    expect(nextCookTime(25)).toBe(30);
    expect(nextCookTime(60)).toBeNull();
  });
});

describe('metas de nutrición (US-136, US-159)', () => {
  it('solo la proteína se elige; carbohidratos y grasa completan el 100 %', () => {
    expect(macroSplit(30)).toEqual({ protein: 30, carbs: 40, fat: 30 });
    expect(macroSplit(40)).toEqual({ protein: 40, carbs: 30, fat: 30 });
    for (const p of [15, 25, 45]) {
      const m = macroSplit(p);
      expect(m.protein + m.carbs + m.fat).toBe(100);
    }
  });

  it('la meta de kcal es opcional y razonable (800–6000)', () => {
    expect(kcalTargetSchema.safeParse(null).success).toBe(true);
    expect(kcalTargetSchema.safeParse(2000).success).toBe(true);
    expect(kcalTargetSchema.safeParse(500).success).toBe(false);
    expect(kcalTargetSchema.safeParse(9000).success).toBe(false);
  });
});
