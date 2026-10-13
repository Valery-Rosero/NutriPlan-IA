import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useServices } from '@/di/services';
import type { MealSlot } from '@/features/cooking/domain/cooking';
import { todayIso } from '@/features/pantry/domain/pantry';
import type { GeneratePlanInput } from '@/features/plan/domain/plan';

export const planKeys = {
  all: ['plan'] as const,
  current: (today: string) => [...planKeys.all, 'current', today] as const,
  budget: (planId: string) => [...planKeys.all, 'budget', planId] as const,
  alternatives: (slot: MealSlot, exclude: string) => [...planKeys.all, 'alternatives', slot, exclude] as const,
};

/** El plan vigente: se guarda en disco para consultarlo sin conexión (ADR-014). */
export function useCurrentPlan() {
  const { plans } = useServices();
  const today = todayIso();
  return useQuery({ queryKey: planKeys.current(today), queryFn: () => plans.current(today), meta: { persist: true } });
}

export function usePlanBudget(planId: string | undefined) {
  const { plans } = useServices();
  return useQuery({ queryKey: planKeys.budget(planId ?? ''), queryFn: () => plans.budget(planId!), enabled: !!planId });
}

export function useAlternatives(slot: MealSlot, excludeRecipeId: string) {
  const { plans } = useServices();
  return useQuery({ queryKey: planKeys.alternatives(slot, excludeRecipeId), queryFn: () => plans.alternatives(slot, excludeRecipeId) });
}

function usePlanMutation<T>(fn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => queryClient.invalidateQueries({ queryKey: planKeys.all }) });
}

export function useGeneratePlan() {
  const { plans } = useServices();
  return usePlanMutation((input: GeneratePlanInput) => plans.generate(input));
}

export function useSwapMeal() {
  const { plans } = useServices();
  return usePlanMutation(({ mealId, recipeId, previousRecipeId }: { mealId: string; recipeId: string; previousRecipeId: string }) =>
    plans.swap(mealId, recipeId, previousRecipeId),
  );
}

export function useSkipMeal() {
  const { plans } = useServices();
  return usePlanMutation((mealId: string) => plans.skip(mealId));
}

export function useConfirmPlan() {
  const { plans } = useServices();
  return usePlanMutation((planId: string) => plans.confirm(planId));
}
