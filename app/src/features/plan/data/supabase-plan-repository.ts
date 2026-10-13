import type { SupabaseClient } from '@supabase/supabase-js';

import { AppError, toAppError } from '@/core/errors/app-error';
import type { MealSlot } from '@/features/cooking/domain/cooking';
import type { GeneratePlanInput, MealPlan, PlanRepository } from '@/features/plan/domain/plan';
import type { Database } from '@/types/database';

export class SupabasePlanRepository implements PlanRepository {
  private readonly client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  async current(today: string): Promise<MealPlan | null> {
    const { data, error } = await this.client
      .from('meal_plans')
      .select('id, start_date, end_date, status, budget_limit, planned_meals(id, meal_date, slot, recipe_id, servings, status, reason_code, recipes!planned_meals_recipe_id_fkey(title, total_minutes))')
      .neq('status', 'archived')
      .gte('end_date', today)
      .order('start_date')
      .limit(1)
      .maybeSingle();
    if (error) throw toAppError(error);
    if (!data) return null;
    return {
      id: data.id,
      startDate: data.start_date,
      endDate: data.end_date,
      status: data.status,
      budgetLimit: data.budget_limit,
      meals: data.planned_meals.map((m) => ({
        id: m.id,
        date: m.meal_date,
        slot: m.slot,
        recipeId: m.recipe_id,
        recipeTitle: m.recipes.title,
        totalMinutes: m.recipes.total_minutes ?? 0,
        servings: m.servings,
        status: m.status,
        reasonCode: m.reason_code,
      })),
    };
  }

  async generate({ start, days, slots }: GeneratePlanInput) {
    const { data, error } = await this.client.rpc('generate_plan', { p_start: start, p_days: days, p_slots: slots });
    if (error) throw toAppError(error);
    return data;
  }

  async budget(planId: string) {
    const { data, error } = await this.client.rpc('plan_budget_status', { p_plan_id: planId });
    if (error) throw toAppError(error);
    const row = data[0];
    if (!row) throw new AppError('plan_not_found');
    return { estimatedCost: row.estimated_cost, budgetLimit: row.budget_limit, overBy: row.over_by, missingPrices: row.missing_prices };
  }

  async alternatives(slot: MealSlot, excludeRecipeId: string) {
    const { data, error } = await this.client.rpc('eligible_recipes', { p_slot: slot });
    if (error) throw toAppError(error);
    return data
      .filter((r) => r.id !== excludeRecipeId)
      .map((r) => ({ id: r.id, title: r.title, totalMinutes: r.total_minutes ?? 0 }))
      .sort((a, b) => a.title.localeCompare(b.title, 'es'));
  }

  async swap(mealId: string, recipeId: string, previousRecipeId: string) {
    // El trigger planned_meals_validate vuelve a comprobar alergias, dieta y momento del día (US-129).
    const { error } = await this.client
      .from('planned_meals')
      .update({ recipe_id: recipeId, replaced_recipe_id: previousRecipeId, reason_code: 'user_request', reason_ingredient_id: null })
      .eq('id', mealId)
      .eq('status', 'planned');
    if (error) throw toAppError(error);
  }

  async skip(mealId: string) {
    const { error } = await this.client.from('planned_meals').update({ status: 'skipped' }).eq('id', mealId).eq('status', 'planned');
    if (error) throw toAppError(error);
  }

  async confirm(planId: string) {
    const { error } = await this.client.from('meal_plans').update({ status: 'confirmed' }).eq('id', planId);
    if (error) throw toAppError(error);
  }
}
