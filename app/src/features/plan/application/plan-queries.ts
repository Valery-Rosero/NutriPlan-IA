import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useServices } from '@/di/services';
import { useKitchenChanged } from '@/features/kitchen/application/kitchen-sync';
import { useTrack } from '@/features/analytics/application/use-track';
import type { MealSlot } from '@/features/cooking/domain/cooking';
import { todayIso } from '@/features/pantry/domain/pantry';
import type { GeneratePlanInput, SavingSuggestion, WeekGoal } from '@/features/plan/domain/plan';

export const planKeys = {
  all: ['plan'] as const,
  current: (today: string) => [...planKeys.all, 'current', today] as const,
  budget: (planId: string) => [...planKeys.all, 'budget', planId] as const,
  alternatives: (slot: MealSlot, exclude: string) => [...planKeys.all, 'alternatives', slot, exclude] as const,
  savings: (planId: string) => [...planKeys.all, 'savings', planId] as const,
  weekChanges: (planId: string, goal: WeekGoal | null, avoid: string[]) =>
    [...planKeys.all, 'week-changes', planId, goal, avoid.join(',')] as const,
};

/** US-174: propuesta de cambios a la semana (la calcula la base; nada cambia hasta aplicar). */
export function useWeekChanges(planId: string | undefined, goal: WeekGoal | null, avoid: string[]) {
  const { plans } = useServices();
  return useQuery({
    queryKey: planKeys.weekChanges(planId ?? '', goal, avoid),
    queryFn: () => plans.proposeWeekChanges(planId!, goal, avoid),
    enabled: !!planId && (!!goal || avoid.length > 0),
  });
}

/**
 * US-174: aplica lo marcado y rehace la lista de mercado (S-3: la lista y el presupuesto quedan al día).
 * Si rehacer la lista falla, los cambios ya quedaron: la lista se puede revisar desde Mi cocina.
 */
export function useApplyWeekChanges() {
  const { plans } = useServices();
  const kitchenChanged = useKitchenChanged();
  return useMutation({
    mutationFn: ({ planId, changes }: { planId: string; changes: { plannedMealId: string; recipeId: string }[] }) =>
      plans.applyWeekChanges(planId, changes),
    onSuccess: kitchenChanged,
  });
}

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

/** Cambiar u omitir una comida cambia lo que hay que comprar: "la cocina cambió" rehace la lista (ADR-033). */
function usePlanMutation<T>(fn: (input: T) => Promise<unknown>) {
  const kitchenChanged = useKitchenChanged();
  return useMutation({ mutationFn: fn, onSuccess: kitchenChanged });
}

/** Organizar la semana deja lista también la lista de mercado (lo que falta según la cocina). */
export function useGeneratePlan() {
  const { plans, shopping } = useServices();
  const queryClient = useQueryClient();
  const track = useTrack();
  return useMutation({
    mutationFn: async (input: GeneratePlanInput) => {
      const planId = await plans.generate(input);
      await shopping.generate(planId);
      return planId;
    },
    onSuccess: () => {
      track('plan_generated');
      track('shopping_list_generated');
      void queryClient.invalidateQueries({ queryKey: planKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['shopping'] });
    },
  });
}

/** US-152: se piden solo cuando la persona toca "Ajustar automáticamente". */
export function useSavings(planId: string, enabled: boolean) {
  const { plans } = useServices();
  return useQuery({ queryKey: planKeys.savings(planId), queryFn: () => plans.savings(planId), enabled });
}

/** Aceptar un ahorro es un cambio normal (lo valida la base); recalcula el total y las demás sugerencias. */
export function useAcceptSaving() {
  const { plans } = useServices();
  return usePlanMutation((s: SavingSuggestion) =>
    plans.swap(s.plannedMealId, s.alternativeRecipeId, s.currentRecipeId, 'budget_friendly'),
  );
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
