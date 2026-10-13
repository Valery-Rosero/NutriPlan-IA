import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useServices } from '@/di/services';
import { cookingKeys } from '@/features/cooking/application/use-suggestions';
import { addDays, sortPantry, todayIso, type NewPantryItem } from '@/features/pantry/domain/pantry';
import type { QuickItem } from '@/features/pantry/domain/quick-add';

export const pantryKeys = {
  all: ['pantry'] as const,
  items: () => [...pantryKeys.all, 'items'] as const,
  search: (query: string) => [...pantryKeys.all, 'search', query] as const,
  units: () => [...pantryKeys.all, 'units'] as const,
};

export function usePantry() {
  const { pantry } = useServices();
  return useQuery({ queryKey: pantryKeys.items(), queryFn: async () => sortPantry(await pantry.list()) });
}

/** Lo que hay en la despensa cambia qué se puede cocinar: se invalidan las sugerencias. */
function useInvalidatePantry() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: pantryKeys.items() });
    void queryClient.invalidateQueries({ queryKey: cookingKeys.all });
  };
}

export function useAddToPantry() {
  const { pantry } = useServices();
  const invalidate = useInvalidatePantry();
  return useMutation({ mutationFn: (item: NewPantryItem) => pantry.add(item), onSuccess: invalidate });
}

/** Un toque: agrega lo típico con vencimiento según la vida útil del ingrediente. */
export function useQuickAdd() {
  const { pantry } = useServices();
  const invalidate = useInvalidatePantry();
  return useMutation({
    mutationFn: async (item: QuickItem) => {
      const [[ingredient], units] = await Promise.all([pantry.findByNames([item.name]), pantry.listUnits()]);
      const unit = units.find((u) => u.code === item.unitCode);
      if (!ingredient || !unit) throw new Error('unknown');
      await pantry.add({
        ingredientId: ingredient.id,
        quantity: item.quantity,
        unitId: unit.id,
        expiresOn: ingredient.shelfLifeDays ? addDays(todayIso(), ingredient.shelfLifeDays) : null,
      });
    },
    onSuccess: invalidate,
  });
}

export function useRemovePantryItem() {
  const { pantry } = useServices();
  const invalidate = useInvalidatePantry();
  return useMutation({ mutationFn: (id: string) => pantry.remove(id), onSuccess: invalidate });
}

export function useIngredientSearch(query: string) {
  const { pantry } = useServices();
  const term = query.trim();
  return useQuery({
    queryKey: pantryKeys.search(term.toLowerCase()),
    queryFn: () => pantry.search(term),
    enabled: term.length >= 2,
    placeholderData: keepPreviousData,
  });
}

export function useUnits() {
  const { pantry } = useServices();
  return useQuery({ queryKey: pantryKeys.units(), queryFn: () => pantry.listUnits(), staleTime: Infinity });
}
