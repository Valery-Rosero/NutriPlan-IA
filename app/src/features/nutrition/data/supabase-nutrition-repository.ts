import type { SupabaseClient } from '@supabase/supabase-js';

import { toAppError } from '@/core/errors/app-error';
import type { DayMeal, NutritionRepository } from '@/features/nutrition/domain/nutrition';
import type { Database } from '@/types/database';

export class SupabaseNutritionRepository implements NutritionRepository {
  private readonly client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  async day(date?: string): Promise<DayMeal[]> {
    const { data, error } = await this.client.rpc('daily_nutrition', date ? { p_date: date } : {});
    if (error) throw toAppError(error);
    return data
      .filter((r) => r.status !== 'skipped')
      .map((r) => ({
        plannedMealId: r.planned_meal_id,
        slot: r.slot,
        title: r.title,
        status: r.status as 'planned' | 'cooked',
        kcal: Number(r.kcal ?? 0),
        proteinG: Number(r.protein_g ?? 0),
        carbsG: Number(r.carbs_g ?? 0),
        fatG: Number(r.fat_g ?? 0),
      }));
  }
}
