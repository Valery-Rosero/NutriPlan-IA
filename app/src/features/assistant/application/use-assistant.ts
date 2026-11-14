import { useMutation } from '@tanstack/react-query';

import { useServices } from '@/di/services';
import type { AssistantRequest } from '@/features/assistant/domain/assistant';
import { useKitchenChanged } from '@/features/kitchen/application/kitchen-sync';

export function useSendToAssistant() {
  const { assistant } = useServices();
  return useMutation({ mutationFn: (request: AssistantRequest) => assistant.send(request) });
}

/** ADR-037: la IA llena la receta de la idea elegida (la base la valida antes de mostrarla). */
export function useFillIdea() {
  const { assistant } = useServices();
  return useMutation({
    mutationFn: ({ conversationId, messageId, idea }: { conversationId: string; messageId: number; idea: number }) =>
      assistant.fill(conversationId, messageId, idea),
  });
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
