export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** Momento del día según la hora local: antes de las 11 desayuno, hasta las 16 almuerzo, hasta las 18 algo, luego cena. */
export function momentOfDay(hour: number): MealSlot {
  return hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 18 ? 'snack' : 'dinner';
}

export type MissingIngredient = { ingredientId: string; name: string; missingGrams: number };

/** Receta sugerida con lo que hay en la despensa (ADR-020). */
export type CookingSuggestion = {
  recipeId: string;
  title: string;
  totalMinutes: number;
  coverage: number;
  missing: MissingIngredient[];
  usesExpiring: boolean;
};

export interface CookingRepository {
  suggestions(slot?: MealSlot): Promise<CookingSuggestion[]>;
}
