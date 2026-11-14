import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useServices } from '@/di/services';
import { useKitchenChanged } from '@/features/kitchen/application/kitchen-sync';
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

/**
 * Lo que hay en la despensa cambia qué se puede cocinar y qué falta comprar: "la cocina cambió" rehace la lista
 * de mercado y refresca sugerencias (ADR-033).
 */
function useInvalidatePantry() {
  return useKitchenChanged();
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

/** Lo que agregó un toque del agregado rápido, para poder deshacerlo (M1). */
export type QuickAdded = { name: string; ingredientId: string; quantity: number; unitId: number };

/** Un toque: agrega lo típico con vencimiento según la vida útil del ingrediente. */
export function useQuickAdd() {
  const { pantry } = useServices();
  const invalidate = useInvalidatePantry();
  return useMutation({
    mutationFn: async (item: QuickItem): Promise<QuickAdded> => {
      const [[ingredient], units] = await Promise.all([pantry.findByNames([item.name]), pantry.listUnits()]);
      const unit = units.find((u) => u.code === item.unitCode);
      if (!ingredient || !unit) throw new Error('unknown');
      await pantry.add({
        ingredientId: ingredient.id,
        quantity: item.quantity,
        unitId: unit.id,
        expiresOn: ingredient.shelfLifeDays ? addDays(todayIso(), ingredient.shelfLifeDays) : null,
      });
      return { name: item.name, ingredientId: ingredient.id, quantity: item.quantity, unitId: unit.id };
    },
    onSuccess: invalidate,
  });
}

/** M1: tocar otra vez lo que se agregó con un toque lo quita (resta exactamente lo que se sumó). */
export function useUndoQuickAdd() {
  const { pantry } = useServices();
  const invalidate = useInvalidatePantry();
  return useMutation({
    mutationFn: (added: QuickAdded) => pantry.adjust(added.ingredientId, -added.quantity, added.unitId),
    onSuccess: invalidate,
  });
}

/** Quitar una fila: si junta varias compras (A6), se quitan todas. */
export function useRemovePantryItem() {
  const { pantry } = useServices();
  const invalidate = useInvalidatePantry();
  return useMutation({
    mutationFn: async (item: Pick<PantryItem, 'id' | 'ingredientId' | 'lots'>) => {
      for (const lot of item.lots ?? [item]) await pantry.remove(lot);
    },
    onSuccess: invalidate,
  });
}

/**
 * M5: deshacer "quitar": vuelve a poner cada compra tal como estaba (gramos y fecha) o el alimento propio.
 */
export function useRestorePantryItem() {
  const { pantry } = useServices();
  const invalidate = useInvalidatePantry();
  return useMutation({
    mutationFn: async (item: PantryItem) => {
      const grams = (await pantry.listUnits()).find((u) => u.code === 'g');
      for (const lot of item.lots ?? [item]) {
        if (lot.custom) {
          await pantry.addCustom({
            name: lot.name, quantity: lot.custom.quantity, unit: lot.custom.unit, expiresOn: lot.expiresOn,
            foodGroupId: lot.foodGroupId ?? null, storeCategoryId: null,
          });
        } else if (lot.ingredientId && grams) {
          await pantry.add({ ingredientId: lot.ingredientId, quantity: lot.grams, unitId: grams.id, expiresOn: lot.expiresOn });
        }
      }
    },
    onSuccess: invalidate,
  });
}

/**
 * C3: cambiar cuánto queda (− / +, ¼ ½ ¾, "se acabó"). Se manda la diferencia: la base resta primero lo
 * que vence antes. Un alimento propio se corrige en su tabla; en 0 se quita.
 */
export function useSetPantryAmount() {
  const { pantry } = useServices();
  const invalidate = useInvalidatePantry();
  return useMutation({
    mutationFn: async ({ item, amount }: { item: PantryItem; amount: number }) => {
      if (item.custom) {
        if (amount <= 0) await pantry.remove(item);
        else await pantry.updateCustom(item.id, { quantity: amount });
        return;
      }
      const delta = Math.round((amount - item.grams) * 100) / 100;
      if (item.ingredientId && delta !== 0) await pantry.adjust(item.ingredientId, delta);
    },
    onSuccess: invalidate,
  });
}

/** C3 / M2: cambiar la fecha de un lote o de un alimento propio ("todavía sirve" incluido). */
export function useSetPantryExpiry() {
  const { pantry } = useServices();
  const invalidate = useInvalidatePantry();
  return useMutation({
    mutationFn: ({ item, expiresOn }: { item: PantryItem; expiresOn: string | null }) =>
      item.custom ? pantry.updateCustom(item.id, { expiresOn }) : pantry.setExpiry(item.id, expiresOn),
    onSuccess: invalidate,
  });
}

/** M2: "Quitar lo vencido" de una vez. */
export function useRemoveExpired() {
  const { pantry } = useServices();
  const invalidate = useInvalidatePantry();
  return useMutation({ mutationFn: () => pantry.removeExpired(), onSuccess: invalidate });
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
