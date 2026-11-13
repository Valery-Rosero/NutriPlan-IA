import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useServices } from '@/di/services';
import { todayIso } from '@/features/pantry/domain/pantry';
import type { MealPlan } from '@/features/plan/domain/plan';
import type { ShoppingRepository } from '@/features/shopping/domain/shopping';

/**
 * Todo lo que depende de "qué hay en la cocina" y "qué se va a cocinar" (revisión de Mi cocina, D3). Claves raíz
 * escritas aquí (y no importadas de cada módulo) para no crear importaciones circulares entre pantry, shopping y plan.
 */
const KITCHEN_KEYS = [['pantry'], ['shopping'], ['cooking'], ['plan'], ['nutrition'], ['spending']] as const;

/**
 * "La cocina cambió" (ADR-033, C2): se rehace la lista de mercado del plan vigente para que siempre esté al día
 * (generate_shopping_list es idempotente y respeta lo marcado y lo manual) y se refresca todo lo que depende de la
 * cocina. Si rehacer la lista falla (sin conexión), lo demás se refresca igual y la lista se pone al día después.
 */
export async function syncKitchen(queryClient: QueryClient, shopping: ShoppingRepository) {
  const plan = queryClient.getQueryData<MealPlan | null>(['plan', 'current', todayIso()]);
  if (plan?.id) await shopping.generate(plan.id).catch(() => undefined);
  await Promise.all(KITCHEN_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey: [...queryKey] })));
}

/** Para usar en `onSuccess` de cualquier cambio a la cocina o al plan. */
export function useKitchenChanged() {
  const { shopping } = useServices();
  const queryClient = useQueryClient();
  return useCallback(() => syncKitchen(queryClient, shopping), [queryClient, shopping]);
}
