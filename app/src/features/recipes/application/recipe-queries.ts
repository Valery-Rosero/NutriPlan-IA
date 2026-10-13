import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useServices } from '@/di/services';
import { cookingKeys } from '@/features/cooking/application/use-suggestions';
import type { MealSlot } from '@/features/cooking/domain/cooking';
import { pantryKeys } from '@/features/pantry/application/pantry-queries';
import { planKeys } from '@/features/plan/application/plan-queries';
import type { Choice } from '@/features/recipes/domain/recipe';

export const recipeKeys = {
  all: ['recipes'] as const,
  detail: (id: string) => [...recipeKeys.all, 'detail', id] as const,
  preview: (id: string, servings: number, choices: Choice[]) =>
    [...recipeKeys.all, 'preview', id, servings, choices.map((c) => `${c.groupKey}:${c.ingredientId}`).sort().join(',')] as const,
};

export function useRecipe(id: string) {
  const { recipes } = useServices();
  return useQuery({ queryKey: recipeKeys.detail(id), queryFn: () => recipes.getDetail(id) });
}

export function useRecipePreview(id: string, servings: number, choices: Choice[] | null) {
  const { recipes } = useServices();
  return useQuery({
    queryKey: recipeKeys.preview(id, servings, choices ?? []),
    queryFn: () => recipes.preview(id, servings, choices ?? []),
    enabled: choices !== null,
    placeholderData: keepPreviousData, // al cambiar porciones u opciones no parpadea
  });
}

/** Cocinar cambia la despensa y por lo tanto las sugerencias. */
function useInvalidateAfterCooking() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: pantryKeys.all });
    void queryClient.invalidateQueries({ queryKey: cookingKeys.all });
    void queryClient.invalidateQueries({ queryKey: recipeKeys.all });
    void queryClient.invalidateQueries({ queryKey: planKeys.all });
  };
}

export function useCookNow(id: string) {
  const { recipes } = useServices();
  const invalidate = useInvalidateAfterCooking();
  return useMutation({
    mutationFn: ({ slot, servings, choices }: { slot: MealSlot; servings: number; choices: Choice[] }) =>
      recipes.cookNow(id, slot, servings, choices),
    onSuccess: invalidate,
  });
}

export function useCookPlanned() {
  const { recipes } = useServices();
  const invalidate = useInvalidateAfterCooking();
  return useMutation({
    mutationFn: ({ plannedMealId, choices }: { plannedMealId: string; choices: Choice[] }) => recipes.cookPlanned(plannedMealId, choices),
    onSuccess: invalidate,
  });
}

export function useUndoCook() {
  const { recipes } = useServices();
  const invalidate = useInvalidateAfterCooking();
  return useMutation({ mutationFn: (plannedMealId: string) => recipes.undoCook(plannedMealId), onSuccess: invalidate });
}
