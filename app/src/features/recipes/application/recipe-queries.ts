import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { useServices } from '@/di/services';
import { useTrack } from '@/features/analytics/application/use-track';
import { cookingKeys } from '@/features/cooking/application/use-suggestions';
import type { MealSlot } from '@/features/cooking/domain/cooking';
import { nutritionKeys } from '@/features/nutrition/application/use-nutrition';
import { pantryKeys } from '@/features/pantry/application/pantry-queries';
import { planKeys } from '@/features/plan/application/plan-queries';
import type { Choice, RatingTag } from '@/features/recipes/domain/recipe';

export const recipeKeys = {
  all: ['recipes'] as const,
  detail: (id: string) => [...recipeKeys.all, 'detail', id] as const,
  substitutes: (ingredientIds: string[]) => [...recipeKeys.all, 'substitutes', [...ingredientIds].sort().join(',')] as const,
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

/** US-147: sustitutos de lo que falta (filtrados por alergias y dietas en la base). */
export function useSubstitutes(ingredientIds: string[]) {
  const { recipes } = useServices();
  return useQuery({
    queryKey: recipeKeys.substitutes(ingredientIds),
    queryFn: () => recipes.substitutes(ingredientIds),
    enabled: ingredientIds.length > 0,
    staleTime: 5 * 60_000,
  });
}

/** Cocinar cambia la despensa y por lo tanto las sugerencias. También es un evento de uso (US-131). */
function useAfterCooking() {
  const queryClient = useQueryClient();
  const track = useTrack();
  return () => {
    track('meal_cooked');
    invalidateCooking(queryClient);
  };
}

function useInvalidateAfterCooking() {
  const queryClient = useQueryClient();
  return () => invalidateCooking(queryClient);
}

function invalidateCooking(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: pantryKeys.all });
  void queryClient.invalidateQueries({ queryKey: cookingKeys.all });
  void queryClient.invalidateQueries({ queryKey: recipeKeys.all });
  void queryClient.invalidateQueries({ queryKey: planKeys.all });
  void queryClient.invalidateQueries({ queryKey: nutritionKeys.all });
}

export function useCookNow(id: string) {
  const { recipes } = useServices();
  const invalidate = useAfterCooking();
  return useMutation({
    mutationFn: ({ slot, servings, choices }: { slot: MealSlot; servings: number; choices: Choice[] }) =>
      recipes.cookNow(id, slot, servings, choices),
    onSuccess: invalidate,
  });
}

export function useCookPlanned() {
  const { recipes } = useServices();
  const invalidate = useAfterCooking();
  return useMutation({
    mutationFn: ({ plannedMealId, choices }: { plannedMealId: string; choices: Choice[] }) => recipes.cookPlanned(plannedMealId, choices),
    onSuccess: invalidate,
  });
}

/** Calificar afecta futuras recomendaciones (US-134): se recalculan sugerencias y planes. */
export function useRateMeal() {
  const { recipes } = useServices();
  const invalidate = useInvalidateAfterCooking();
  return useMutation({
    mutationFn: ({ plannedMealId, rating, tags, comment }: { plannedMealId: string; rating: number; tags: RatingTag[]; comment: string }) =>
      recipes.rate(plannedMealId, rating, tags, comment),
    onSuccess: invalidate,
  });
}

export function useUndoCook() {
  const { recipes } = useServices();
  const invalidate = useInvalidateAfterCooking();
  return useMutation({ mutationFn: (plannedMealId: string) => recipes.undoCook(plannedMealId), onSuccess: invalidate });
}
