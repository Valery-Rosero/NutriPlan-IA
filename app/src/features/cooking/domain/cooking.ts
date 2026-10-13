export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

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
