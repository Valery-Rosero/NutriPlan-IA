import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useServices } from '@/di/services';
import type { AssistantRequest } from '@/features/assistant/domain/assistant';
import { cookingKeys } from '@/features/cooking/application/use-suggestions';
import { planKeys } from '@/features/plan/application/plan-queries';
import { shoppingKeys } from '@/features/shopping/application/shopping-queries';

export function useSendToAssistant() {
  const { assistant } = useServices();
  return useMutation({ mutationFn: (request: AssistantRequest) => assistant.send(request) });
}

/** Aplicar cambia el plan: se recalculan el plan, la lista y las sugerencias. */
export function useApplySuggestion() {
  const { assistant } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId: number) => assistant.apply(messageId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: planKeys.all });
      void queryClient.invalidateQueries({ queryKey: cookingKeys.all });
      void queryClient.invalidateQueries({ queryKey: shoppingKeys.all });
    },
  });
}
