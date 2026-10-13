import { initialOnboarding, onboardingReducer, type OnboardingEvent } from '@/features/profile/domain/onboarding';
import { budgetSchema, parseCop } from '@/features/profile/domain/profile';

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

  it('termina en done', () => {
    const state = run(true, [
      { type: 'household_saved' },
      { type: 'sensitive_decided', authorized: true },
      { type: 'restrictions_saved' },
      { type: 'budget_saved' },
    ]);
    expect(state.step).toBe('kitchen');
    expect(onboardingReducer(state, { type: 'kitchen_done' }).step).toBe('done');
    expect(onboardingReducer(state, { type: 'back' }).step).toBe('budget');
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
