import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { AppError, toAppError } from '@/core/errors/app-error';
import { useServices } from '@/di/services';
import { useKitchenChanged } from '@/features/kitchen/application/kitchen-sync';
import { useTrack } from '@/features/analytics/application/use-track';
import type { MealSlot } from '@/features/cooking/domain/cooking';
import { todayIso } from '@/features/pantry/domain/pantry';
import { aiRecipesAreEnough, type AiDish, type AiRecipe, type GeneratePlanInput, type SavingSuggestion, type WeekGoal, type MealPlan } from '@/features/plan/domain/plan';

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
/** ADR-039 · en qué va el plan con IA (para mostrar el avance real). */
export type AiPlanProgress = { stage: 'menu' | 'recipes' | 'save'; done: number; total: number } | null;
/** Por qué salió del recetario: la IA no respondió o ya se usaron los 3 planes con IA del día. */
export type AiFallback = 'ai' | 'quota' | null;

/**
 * ADR-039 · Planear con IA: platos → recetas (de a 4, en paralelo) → repartir y guardar. Si la IA no responde, no
 * alcanza o se acabó la cuota del día, el plan sale del recetario (generate_plan) y se dice por qué.
 */
export function useGeneratePlanWithAi() {
  const { plans, shopping } = useServices();
  const queryClient = useQueryClient();
  const track = useTrack();
  const [progress, setProgress] = useState<AiPlanProgress>(null);
  const [fallback, setFallback] = useState<AiFallback>(null);
  const mutation = useMutation({
    mutationFn: async (input: GeneratePlanInput): Promise<{ planId: string; ai: boolean }> => {
      setFallback(null);
      try {
        setProgress({ stage: 'menu', done: 0, total: 1 });
        const dishes = await plans.aiMenu(input.days, input.slots);
        let done = 0;
        setProgress({ stage: 'recipes', done, total: dishes.length });
        const batches: AiDish[][] = [];
        for (let i = 0; i < dishes.length; i += 4) batches.push(dishes.slice(i, i + 4));
        const made = (
          await Promise.all(
            batches.map(async (batch) => {
              const recipes = await plans.aiRecipes(input.slots, batch).catch(() => [] as AiRecipe[]);
              done += batch.length;
              setProgress({ stage: 'recipes', done, total: dishes.length });
              return recipes;
            }),
          )
        ).flat();
        if (!aiRecipesAreEnough(made, input.slots)) throw new AppError('not_enough_dishes');
        setProgress({ stage: 'save', done: 0, total: 1 });
        const planId = await plans.aiSave(input, made);
        track('plan_generated');
        return { planId, ai: true };
      } catch (error) {
        const code = toAppError(error).code;
        if (code === 'plan_overlap_confirmed' || code === 'network') throw error;
        // Respaldo: el recetario de siempre (reglas en la base, ADR-023).
        setFallback(code === 'quota_exceeded' ? 'quota' : 'ai');
        const planId = await plans.generate(input);
        await shopping.generate(planId).catch(() => undefined);
        track('plan_generated');
        return { planId, ai: false };
      } finally {
        setProgress(null);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: planKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['shopping'] });
    },
  });
  return { ...mutation, progress, fallback };
}

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

/**
 * Omitir se ve al instante (la comida pasa a "omitida" sin esperar a la base); si la base no lo acepta, vuelve
 * como estaba y la pantalla muestra el error.
 */
export function useSkipMeal() {
  const { plans } = useServices();
  const queryClient = useQueryClient();
  const kitchenChanged = useKitchenChanged();
  return useMutation<void, Error, string, { previous?: MealPlan | null }>({
    mutationFn: (mealId) => plans.skip(mealId),
    onMutate: async (mealId) => {
      const key = planKeys.current(todayIso());
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MealPlan | null>(key);
      if (previous) {
        queryClient.setQueryData<MealPlan>(key, {
          ...previous,
          meals: previous.meals.map((m) => (m.id === mealId ? { ...m, status: 'skipped' as const } : m)),
        });
      }
      return { previous };
    },
    onError: (_error, _mealId, context) => {
      if (context?.previous) queryClient.setQueryData(planKeys.current(todayIso()), context.previous);
    },
    onSuccess: () => kitchenChanged(),
  });
}

export function useConfirmPlan() {
  const { plans } = useServices();
  return usePlanMutation((planId: string) => plans.confirm(planId));
}
