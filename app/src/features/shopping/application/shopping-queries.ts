import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import type { Services } from '@/di/services';
import { useServices } from '@/di/services';
import { cookingKeys } from '@/features/cooking/application/use-suggestions';
import { pantryKeys } from '@/features/pantry/application/pantry-queries';
import { applyChecked, type ShoppingList } from '@/features/shopping/domain/shopping';

export const shoppingKeys = {
  all: ['shopping'] as const,
  list: (planId: string) => [...shoppingKeys.all, 'list', planId] as const,
  /** Clave de la mutación de casillas: con ella se reanudan las pendientes tras reiniciar la app. */
  toggle: ['shopping', 'toggle'] as const,
};

type Toggle = { planId: string; itemId: string; checked: boolean };

/** La lista se guarda en disco: se consulta en el supermercado aunque no haya señal (ADR-014). */
export function useShoppingList(planId: string | undefined) {
  const { shopping } = useServices();
  return useQuery({
    queryKey: shoppingKeys.list(planId ?? ''),
    queryFn: () => shopping.forPlan(planId!),
    enabled: !!planId,
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

function useListMutation<T>(fn: (input: T) => Promise<unknown>, alsoInvalidatePantry = false) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: shoppingKeys.all });
      if (alsoInvalidatePantry) {
        void queryClient.invalidateQueries({ queryKey: pantryKeys.all });
        void queryClient.invalidateQueries({ queryKey: cookingKeys.all });
      }
    },
  });
}

export function useGenerateList() {
  const { shopping } = useServices();
  return useListMutation((planId: string) => shopping.generate(planId));
}

export function useAddManualItem() {
  const { shopping } = useServices();
  return useListMutation(({ listId, name }: { listId: string; name: string }) => shopping.addManual(listId, name));
}

export function useRemoveItem() {
  const { shopping } = useServices();
  return useListMutation((itemId: string) => shopping.remove(itemId));
}

export function useMoveToPantry() {
  const { shopping } = useServices();
  return useListMutation((listId: string) => shopping.moveCheckedToPantry(listId), true);
}
