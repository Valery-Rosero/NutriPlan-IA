import type { MealSlot } from '@/features/cooking/domain/cooking';
import type { IconName } from '@/shared/ui';

/** Ícono de cada momento del día: el mismo en Hoy, Mi semana y donde se muestre una comida. */
export const SLOT_ICON: Record<MealSlot, IconName> = {
  breakfast: 'cafe-outline',
  lunch: 'restaurant-outline',
  snack: 'nutrition-outline',
  dinner: 'moon-outline',
};
