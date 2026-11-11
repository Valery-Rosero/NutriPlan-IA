import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useServices } from '@/di/services';

export const spendingKeys = {
  all: ['spending'] as const,
  month: () => [...spendingKeys.all, 'month'] as const,
};

export function useMonthlySpend() {
  const { spending } = useServices();
  return useQuery({ queryKey: spendingKeys.month(), queryFn: () => spending.monthly() });
}

export function useRecordPurchase() {
  const { spending } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ total, listId }: { total: number; listId?: string }) => spending.recordPurchase(total, listId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: spendingKeys.all }),
  });
}
