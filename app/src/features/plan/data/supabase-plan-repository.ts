import type { SupabaseClient } from '@supabase/supabase-js';

import { AppError, toAppError } from '@/core/errors/app-error';
import type { MealSlot } from '@/features/cooking/domain/cooking';
import type { GeneratePlanInput, MealPlan, PlannedMeal, PlanRepository, SwapReason } from '@/features/plan/domain/plan';
import type { Database } from '@/types/database';

export class SupabasePlanRepository implements PlanRepository {
  private readonly client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  async current(today: string): Promise<MealPlan | null> {
    const { data, error } = await this.client
      .from('meal_plans')
      .select(`id, start_date, end_date, status, budget_limit, planned_meals(${MEAL_FIELDS})`)
      .neq('status', 'archived')
      .gte('end_date', today)
      .order('start_date')
      .limit(5);
    if (error) throw toAppError(error);
    // Un plan con solo adicionales (el de un día que crea "Cocinar ahora" sin plan) no es un plan para mostrar.
    const plan = data.find((p) => p.planned_meals.some((m) => !m.is_extra));
    if (!plan) return null;

    // Adicionales de esos días, estén en el plan que estén (regenerar un borrador lo archiva con lo cocinado).
    const extras = await this.client
      .from('planned_meals')
      .select(`${MEAL_FIELDS}, meal_plans!inner(user_id)`)
      .eq('is_extra', true)
      .gte('meal_date', plan.start_date)
      .lte('meal_date', plan.end_date)
      .order('cooked_at');
    if (extras.error) throw toAppError(extras.error);

    return {
      id: plan.id,
      startDate: plan.start_date,
      endDate: plan.end_date,
      status: plan.status,
      budgetLimit: plan.budget_limit,
      meals: plan.planned_meals.filter((m) => !m.is_extra).map(toMeal),
      extras: extras.data.map(toMeal),
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

  async savings(planId: string) {
    const { data, error } = await this.client.rpc('plan_savings', { p_plan_id: planId });
    if (error) throw toAppError(error);
    return data.map((r) => ({
      plannedMealId: r.planned_meal_id,
      date: r.meal_date,
      slot: r.slot,
      currentRecipeId: r.current_recipe_id,
      currentTitle: r.current_title,
      currentCost: Number(r.current_cost),
      alternativeRecipeId: r.alternative_recipe_id,
      alternativeTitle: r.alternative_title,
      alternativeCost: Number(r.alternative_cost),
      saving: Number(r.saving),
    }));
  }

  async swap(mealId: string, recipeId: string, previousRecipeId: string, reason: SwapReason = 'user_request') {
    // El trigger planned_meals_validate vuelve a comprobar alergias, dieta y momento del día (US-129).
    const { error } = await this.client
      .from('planned_meals')
      .update({ recipe_id: recipeId, replaced_recipe_id: previousRecipeId, reason_code: reason, reason_ingredient_id: null })
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

const MEAL_FIELDS =
  'id, meal_date, slot, recipe_id, servings, status, reason_code, is_extra, recipes!planned_meals_recipe_id_fkey(title, total_minutes)';

type MealRow = {
  id: string;
  meal_date: string;
  slot: PlannedMeal['slot'];
  recipe_id: string;
  servings: number;
  status: PlannedMeal['status'];
  reason_code: string | null;
  recipes: { title: string; total_minutes: number | null };
};

function toMeal(m: MealRow): PlannedMeal {
  return {
    id: m.id,
    date: m.meal_date,
    slot: m.slot,
    recipeId: m.recipe_id,
    recipeTitle: m.recipes.title,
    totalMinutes: m.recipes.total_minutes ?? 0,
    servings: m.servings,
    status: m.status,
    reasonCode: m.reason_code,
  };
}
