import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import type { MealSlot } from '@/features/cooking/domain/cooking';
import { useAlternatives, useSwapMeal } from '@/features/plan/application/plan-queries';
import { AppText, Banner, Button, EmptyState, ErrorState, LoadingState, Screen } from '@/shared/ui';

/** US-129: cambiar una comida por otra receta elegible para ese momento del día. */
export function SwapMealScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { mealId, slot, recipeId } = useLocalSearchParams<{ mealId: string; slot: MealSlot; recipeId: string }>();
  const alternatives = useAlternatives(slot, recipeId);
  const swap = useSwapMeal();

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('plan.swapTitle') }} />
      <Screen scroll>
        <AppText secondary>{t('plan.swapHint', { slot: t(`slots.${slot}`) })}</AppText>
        {swap.error && <Banner tone="danger" message={t(errorKey(swap.error))} />}
        {alternatives.isPending ? (
          <LoadingState />
        ) : alternatives.isError ? (
          <ErrorState message={t(errorKey(alternatives.error))} onRetry={() => void alternatives.refetch()} />
        ) : alternatives.data.length === 0 ? (
          <EmptyState message={t('plan.noAlternatives')} />
        ) : (
          alternatives.data.map((r) => (
            <Button
              key={r.id}
              variant="secondary"
              label={`${r.title} · ${t('cook.minutes', { count: r.totalMinutes })}`}
              disabled={swap.isPending}
              onPress={() => swap.mutate({ mealId, recipeId: r.id, previousRecipeId: recipeId }, { onSuccess: () => router.back() })}
            />
          ))
        )}
      </Screen>
    </>
  );
}
