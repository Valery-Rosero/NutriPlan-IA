import { useMutation } from '@tanstack/react-query';

import { useServices } from '@/di/services';
import type { AssistantRequest } from '@/features/assistant/domain/assistant';
import { useKitchenChanged } from '@/features/kitchen/application/kitchen-sync';

export function useSendToAssistant() {
  const { assistant } = useServices();
  return useMutation({ mutationFn: (request: AssistantRequest) => assistant.send(request) });
}

/** Aplicar cambia una comida del plan: "la cocina cambió" (plan, lista y sugerencias al día, ADR-033). */
export function useApplySuggestion() {
  const { assistant } = useServices();
  const kitchenChanged = useKitchenChanged();
  return useMutation({
    mutationFn: ({ messageId, recipeId }: { messageId: number; recipeId: string }) => assistant.apply(messageId, recipeId),
    onSuccess: kitchenChanged,
  });
}
