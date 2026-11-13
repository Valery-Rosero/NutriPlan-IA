import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useServices } from '@/di/services';
import { cookingKeys } from '@/features/cooking/application/use-suggestions';
import { classifyQuietly } from '@/features/food/domain/food-label';
import {
  addDays,
  CUSTOM_UNITS,
  sortPantry,
  todayIso,
  type CustomUnit,
  type NewCustomPantryItem,
  type NewPantryItem,
  type PantryItem,
  type PantryPhoto,
  type ParsedPantryItem,
  type PhotoKind,
} from '@/features/pantry/domain/pantry';
import type { QuickItem } from '@/features/pantry/domain/quick-add';

export const pantryKeys = {
  all: ['pantry'] as const,
  items: () => [...pantryKeys.all, 'items'] as const,
  search: (query: string) => [...pantryKeys.all, 'search', query] as const,
  units: () => [...pantryKeys.all, 'units'] as const,
  foodGroups: () => [...pantryKeys.all, 'food-groups'] as const,
  buyNext: () => [...pantryKeys.all, 'buy-next'] as const,
};

/** ADR-030: qué comprar para completar recetas. Depende de la cocina: se invalida con ella (pantryKeys.all). */
export function useBuyNext(enabled = true) {
  const { pantry } = useServices();
  return useQuery({ queryKey: pantryKeys.buyNext(), queryFn: () => pantry.buyNext(3), enabled });
}

/** ADR-032: lo que la IA ve en una foto de la nevera o del recibo → lista para revisar (no guarda nada). */
export function useUnderstandPhoto() {
  const { pantry } = useServices();
  return useMutation({ mutationFn: ({ photo, kind }: { photo: PantryPhoto; kind: PhotoKind }) => pantry.understandPhoto(photo, kind) });
}

/** ADR-030: "Escríbelo como lo dirías" → lista para revisar (no guarda nada). */
export function useUnderstandPantry() {
  const { pantry } = useServices();
  return useMutation({ mutationFn: (text: string) => pantry.understand(text) });
}

/**
 * Guarda lo revisado de una vez: lo del catálogo con add_to_pantry (convierte a gramos y valida) y lo demás
 * como alimento propio, clasificado (B3b). Si algo falla se detiene y lo ya guardado queda.
 */
export function useSaveUnderstood() {
  const { pantry, foodLabels } = useServices();
  const invalidate = useInvalidatePantry();
  return useMutation({
    mutationFn: async (items: ParsedPantryItem[]) => {
      const units = await pantry.listUnits();
      for (const item of items) {
        const expiresOn = item.expiresInDays === null ? null : addDays(todayIso(), item.expiresInDays);
        if (item.ingredientId) {
          const unit = units.find((u) => u.code === item.unit);
          if (!unit) throw new Error('unknown');
          await pantry.add({ ingredientId: item.ingredientId, quantity: item.quantity, unitId: unit.id, expiresOn });
        } else {
          const unit = (CUSTOM_UNITS as readonly string[]).includes(item.unit) ? (item.unit as CustomUnit) : 'unit';
          const label = await classifyQuietly(foodLabels, item.name);
          await pantry.addCustom({
            name: item.name, quantity: item.quantity, unit, expiresOn,
            foodGroupId: label?.foodGroupId ?? null, storeCategoryId: label?.storeCategoryId ?? null,
          });
        }
      }
    },
    onSettled: invalidate,
  });
}

/** Grupos de alimento (datos de referencia: casi nunca cambian). */
export function useFoodGroups() {
  const { pantry } = useServices();
  return useQuery({ queryKey: pantryKeys.foodGroups(), queryFn: () => pantry.foodGroups(), staleTime: Infinity });
}

/** Corrige el grupo que sugirió la IA para un alimento propio (ADR-027: es solo una sugerencia). */
export function useSetCustomGroup() {
  const { pantry } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, foodGroupId }: { id: string; foodGroupId: number }) => pantry.setCustomGroup(id, foodGroupId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pantryKeys.items() }),
  });
}

export function usePantry() {
  const { pantry } = useServices();
  return useQuery({ queryKey: pantryKeys.items(), queryFn: async () => sortPantry(await pantry.list()) });
}

/** Lo que hay en la despensa cambia qué se puede cocinar: se invalidan las sugerencias. */
function useInvalidatePantry() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: pantryKeys.items() });
    void queryClient.invalidateQueries({ queryKey: pantryKeys.buyNext() });
    void queryClient.invalidateQueries({ queryKey: cookingKeys.all });
  };
}

export function useAddToPantry() {
  const { pantry } = useServices();
  const invalidate = useInvalidatePantry();
  return useMutation({ mutationFn: (item: NewPantryItem) => pantry.add(item), onSuccess: invalidate });
}

/**
 * B3b: alimento fuera del catálogo. Se clasifica (grupo y sección) sin estorbar: si la clasificación
 * falla o tarda, se guarda igual, sin grupo.
 */
export function useAddCustomToPantry() {
  const { pantry, foodLabels } = useServices();
  const invalidate = useInvalidatePantry();
  return useMutation({
    mutationFn: async (item: Omit<NewCustomPantryItem, 'foodGroupId' | 'storeCategoryId'>) => {
      const label = await classifyQuietly(foodLabels, item.name);
      await pantry.addCustom({ ...item, foodGroupId: label?.foodGroupId ?? null, storeCategoryId: label?.storeCategoryId ?? null });
    },
    onSuccess: invalidate,
  });
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
  return useMutation({ mutationFn: (item: Pick<PantryItem, 'id' | 'ingredientId'>) => pantry.remove(item), onSuccess: invalidate });
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
