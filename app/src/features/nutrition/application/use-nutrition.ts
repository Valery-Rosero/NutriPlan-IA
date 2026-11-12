import { useQuery } from '@tanstack/react-query';

import { useServices } from '@/di/services';

export const nutritionKeys = {
  all: ['nutrition'] as const,
  day: (date: string) => [...nutritionKeys.all, 'day', date] as const,
};

/** Mi día: se recalcula al cocinar (cocinar invalida esta clave junto con la despensa y el plan). */
export function useDayNutrition(date: string) {
  const { nutrition } = useServices();
  return useQuery({ queryKey: nutritionKeys.day(date), queryFn: () => nutrition.day(date) });
}
