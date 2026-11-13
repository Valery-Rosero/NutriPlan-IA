import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';

import { AppError, toAppError } from '@/core/errors/app-error';
import type { MealSlot } from '@/features/cooking/domain/cooking';
import type { FoodLabel, FoodLabelRepository } from '@/features/food/domain/food-label';
import type { Database } from '@/types/database';

type Payload = {
  ok: boolean;
  data?: {
    name: string;
    is_food: boolean;
    food_group_id: number | null;
    store_category_id: number | null;
    meal_slot: MealSlot | null;
    kcal_per_serving: number | null;
    protein_g_per_serving: number | null;
    source: FoodLabel['source'];
  };
  error?: { code: string };
};

/** Adaptador de la Edge Function categorize-food (B3). */
export class SupabaseFoodLabelRepository implements FoodLabelRepository {
  private readonly client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  async classify(text: string): Promise<FoodLabel> {
    const { data, error } = await this.client.functions.invoke<Payload>('categorize-food', { body: { text } });
    if (error) {
      const body = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
      throw toAppError(body?.error?.code ?? error);
    }
    if (!data?.ok || !data.data) throw new AppError('unknown');
    const d = data.data;
    return {
      name: d.name,
      isFood: d.is_food,
      foodGroupId: d.food_group_id,
      storeCategoryId: d.store_category_id,
      mealSlot: d.meal_slot,
      kcalPerServing: d.kcal_per_serving,
      proteinPerServing: d.protein_g_per_serving,
      source: d.source,
    };
  }
}
