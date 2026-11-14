import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import type { Services } from '@/di/services';
import { useServices } from '@/di/services';
import { useKitchenChanged } from '@/features/kitchen/application/kitchen-sync';
import { useTrack } from '@/features/analytics/application/use-track';
import { classifyQuietly } from '@/features/food/domain/food-label';
import { applyChecked, type ShoppingList } from '@/features/shopping/domain/shopping';

export const shoppingKeys = {
  all: ['shopping'] as const,
  list: (planId: string) => [...shoppingKeys.all, 'list', planId] as const,
  /** Clave de la mutación de casillas: con ella se reanudan las pendientes tras reiniciar la app. */
  toggle: ['shopping', 'toggle'] as const,
};

/** `planId`: la clave de la lista en caché (el plan, o 'house' para la lista de la casa). */
type Toggle = { planId: string; itemId: string; checked: boolean };

/** ADR-035: clave de la lista vigente: la del plan o, sin plan, la de la casa. */
export const HOUSE_LIST = 'house';
export const listKeyFor = (planId: string | undefined) => planId ?? HOUSE_LIST;

/**
 * La lista vigente: la del plan o, sin plan, la de la casa (A1: la lista existe siempre). `ready` = ya se
 * sabe si hay plan (para no pedir la de la casa mientras carga el plan). Se guarda en disco: se consulta en
 * el supermercado aunque no haya señal (ADR-014).
 */
export function useShoppingList(planId: string | undefined, ready = true) {
  const { shopping } = useServices();
  return useQuery({
    queryKey: shoppingKeys.list(listKeyFor(planId)),
    queryFn: () => (planId ? shopping.forPlan(planId) : shopping.forHouse()),
    enabled: ready,
    meta: { persist: true },
  });
}

/**
 * Registra cómo ejecutar una casilla pendiente. Sin conexión, la mutación queda en pausa, se
 * persiste con la caché y se reanuda al volver la conexión (o al abrir la app otra vez).
 */
export function registerShoppingMutations(queryClient: QueryClient, services: Services) {
  queryClient.setMutationDefaults(shoppingKeys.toggle, {
    mutationFn: ({ itemId, checked }: Toggle) => services.shopping.setChecked(itemId, checked),
  });
}

/** US-147: reemplazar un ítem del plan por su sustituto (o deshacerlo); la base rehace la lista. */
export function useSubstituteItem() {
  const { shopping } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, substituteId }: { planId: string; itemId: string; substituteId: string }) =>
      shopping.substitute(itemId, substituteId),
    onSuccess: (_data, { planId }) => queryClient.invalidateQueries({ queryKey: shoppingKeys.list(planId) }),
  });
}

export function useUndoSubstitution() {
  const { shopping } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId }: { planId: string; itemId: string }) => shopping.undoSubstitution(itemId),
    onSuccess: (_data, { planId }) => queryClient.invalidateQueries({ queryKey: shoppingKeys.list(planId) }),
  });
}

export function useToggleItem() {
  const { shopping } = useServices();
  const queryClient = useQueryClient();
  return useMutation<void, Error, Toggle, { previous?: ShoppingList | null }>({
    mutationKey: shoppingKeys.toggle,
    mutationFn: ({ itemId, checked }) => shopping.setChecked(itemId, checked),
    networkMode: 'offlineFirst',
    onMutate: async ({ planId, itemId, checked }) => {
      const key = shoppingKeys.list(planId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ShoppingList | null>(key);
      if (previous) queryClient.setQueryData(key, applyChecked(previous, itemId, checked));
      return { previous };
    },
    onError: (_error, { planId }, context) => {
      if (context?.previous) queryClient.setQueryData(shoppingKeys.list(planId), context.previous);
    },
    onSettled: (_data, _error, { planId }) => {
      if (queryClient.isMutating({ mutationKey: shoppingKeys.toggle }) === 1) {
        void queryClient.invalidateQueries({ queryKey: shoppingKeys.list(planId) });
      }
    },
  });
}

function useListMutation<T>(fn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => queryClient.invalidateQueries({ queryKey: shoppingKeys.all }) });
}

export function useGenerateList() {
  const { shopping } = useServices();
  const track = useTrack();
  return useListMutation(async (planId: string) => {
    await shopping.generate(planId);
    track('shopping_list_generated');
  });
}

/** B3: lo escrito a mano va a su sección del supermercado (clasificación con IA); si no se puede, a "Otros". */
export function useAddManualItem() {
  const { shopping, foodLabels } = useServices();
  return useListMutation(async ({ listId, name }: { listId: string; name: string }) => {
    const label = await classifyQuietly(foodLabels, name);
    await shopping.addManual(listId, name, label?.storeCategoryId ?? null);
  });
}

/**
 * Lo que le falta a una receta o a una sugerencia, a la lista de una vez y como INGREDIENTES con sus gramos
 * (ADR-033, C1): al comprarlos pasan a la despensa. Si ya estaban, la base suma; si el plan ya los pide, no duplica.
 */
export function useAddMissingToList() {
  const { shopping } = useServices();
  return useListMutation(
    async ({ list, planId, items }: { list: ShoppingList | null | undefined; planId?: string; items: { ingredientId: string; grams: number }[] }) => {
      // Siempre hay dónde anotarlo (A1): la lista vigente; si el plan aún no tiene lista, se arma; sin plan, la de la casa.
      const listId = list?.id ?? (planId ? await shopping.generate(planId) : (await shopping.forHouse()).id);
      return shopping.addIngredients(listId, items);
    },
  );
}

/** M5: quitar de la lista se puede deshacer. */
export function useRemoveItem() {
  const { shopping } = useServices();
  return useListMutation((itemId: string) => shopping.remove(itemId));
}

export function useRestoreItem() {
  const { shopping } = useServices();
  return useListMutation((itemId: string) => shopping.restore(itemId));
}

/** Lo comprado pasa a la despensa: "la cocina cambió" (despensa, sugerencias y lista al día). */
export function useMoveToPantry() {
  const { shopping } = useServices();
  const kitchenChanged = useKitchenChanged();
  return useMutation({ mutationFn: (listId: string) => shopping.moveCheckedToPantry(listId), onSuccess: () => kitchenChanged() });
}
