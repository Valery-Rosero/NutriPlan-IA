import { useQuery } from '@tanstack/react-query';

import { useServices } from '@/di/services';
import type { MealSlot } from '@/features/cooking/domain/cooking';

export const cookingKeys = {
  all: ['cooking'] as const,
  suggestions: (slot?: MealSlot) => [...cookingKeys.all, 'suggestions', slot ?? 'any'] as const,
};

/** "¿Qué cocino con lo que tengo?" (ADR-020). */
export function useCookingSuggestions(slot?: MealSlot) {
  const { cooking } = useServices();
  return useQuery({ queryKey: cookingKeys.suggestions(slot), queryFn: () => cooking.suggestions(slot) });
}
