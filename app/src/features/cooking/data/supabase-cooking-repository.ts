import type { SupabaseClient } from '@supabase/supabase-js';

import { toAppError } from '@/core/errors/app-error';
import type { CookingRepository, MealSlot } from '@/features/cooking/domain/cooking';
import type { Database } from '@/types/database';

type MissingRow = { ingredient_id: string; ingredient_name: string; missing_g: number };

export class SupabaseCookingRepository implements CookingRepository {
  private readonly client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  async suggestions(slot?: MealSlot) {
    const { data, error } = await this.client.rpc('cook_with_what_i_have', { p_slot: slot });
    if (error) throw toAppError(error);
    return data.map((row) => ({
      recipeId: row.recipe_id,
      title: row.title,
      totalMinutes: row.total_minutes,
      coverage: row.coverage,
      usesExpiring: row.uses_expiring,
      missing: (row.missing as unknown as MissingRow[]).map((m) => ({
        ingredientId: m.ingredient_id,
        name: m.ingredient_name,
        missingGrams: m.missing_g,
      })),
    }));
  }
}
