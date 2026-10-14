import { useEffect, useReducer } from 'react';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useUpdateProfile } from '@/features/profile/application/profile-queries';
import { initialOnboarding, onboardingReducer, stepNumber, ONBOARDING_STEPS } from '@/features/profile/domain/onboarding';
import { QuickAdd } from '@/features/pantry/ui/quick-add';
import { BudgetForm } from '@/features/profile/ui/budget-form';
import { HouseholdForm } from '@/features/profile/ui/household-form';
import { RestrictionsForm } from '@/features/profile/ui/restrictions-form';
import { SensitiveStep } from '@/features/profile/ui/sensitive-step';
import { Banner, BrandHeader, Button, Card, LoadingState, Screen, StepProgress, TextLink } from '@/shared/ui';

/**
 * Onboarding (US-106 a US-109). Cada paso se guarda al continuar, así que se puede retomar.
 * "Completar después" (US-130) marca el onboarding como hecho; sin alergias declaradas, la app lo advierte.
 */
export function OnboardingScreen() {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(onboardingReducer, false, initialOnboarding);
  const finish = useUpdateProfile();

  useEffect(() => {
    if (state.step === 'done' && finish.isIdle) finish.mutate({ onboardingCompleted: true });
  }, [state.step, finish]);

  if (state.step === 'done') {
    return (
      <Screen>
        {finish.isError ? (
          <Banner tone="danger" message={t(errorKey(finish.error))} />
        ) : (
          <LoadingState />
        )}
      </Screen>
    );
  }

  const later = () => finish.mutate({ onboardingCompleted: true });
  const next = t('common.continue');
  const progress = t('onboarding.progress', { step: stepNumber(state.step), total: ONBOARDING_STEPS.length });

  return (
    <Screen scroll>
      <BrandHeader
        eyebrow={progress}
        title={t(`onboarding.titles.${state.step}`)}
        subtitle={t(`onboarding.subtitles.${state.step}`)}
        back={state.step !== 'household' ? { label: t('common.back'), onPress: () => dispatch({ type: 'back' }) } : undefined}>
        <StepProgress step={stepNumber(state.step)} total={ONBOARDING_STEPS.length} label={progress} />
      </BrandHeader>

      {state.step === 'household' && <HouseholdForm submitLabel={next} onSaved={() => dispatch({ type: 'household_saved' })} />}
      {state.step === 'sensitive' && (
        <SensitiveStep onDecided={(authorized) => dispatch({ type: 'sensitive_decided', authorized })} />
      )}
      {state.step === 'restrictions' && (
        <RestrictionsForm submitLabel={next} onSaved={() => dispatch({ type: 'restrictions_saved' })} />
      )}
      {state.step === 'budget' && (
        <BudgetForm submitLabel={next} onSaved={() => dispatch({ type: 'budget_saved' })} />
      )}
      {state.step === 'kitchen' && (
        <>
          <Card variant="primary">
            <QuickAdd />
          </Card>
          <Button label={t('onboarding.finish')} icon="restaurant-outline" onPress={() => dispatch({ type: 'kitchen_done' })} />
        </>
      )}

      <TextLink label={t('onboarding.later')} hint={t('onboarding.laterHint')} onPress={later} />
    </Screen>
  );
}
