import type { SupabaseClient } from '@supabase/supabase-js';

import { AppError, toAppError } from '@/core/errors/app-error';
import type { MealSlot } from '@/features/cooking/domain/cooking';
import { previewSchema, type Choice, type FlexGroup, type RecipeRepository } from '@/features/recipes/domain/recipe';
import type { Database } from '@/types/database';

const toJson = (choices: Choice[]) => choices.map((c) => ({ group_key: c.groupKey, ingredient_id: c.ingredientId }));

type CookRow = { planned_meal_id: string; shortfall: { ingredient_id: string; ingredient_name: string; missing_g: number }[] };

export class SupabaseRecipeRepository implements RecipeRepository {
  private readonly client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  async getDetail(id: string) {
    const [recipe, menu] = await Promise.all([
      this.client
        .from('recipes')
        .select('id, title, description, total_minutes, base_servings, keeps_days, recipe_meal_slots(slot), recipe_steps(step_number, instruction)')
        .eq('id', id)
        .single(),
      this.client.rpc('recipe_flex_menu', { p_recipe_id: id }),
    ]);
    if (recipe.error) throw toAppError(recipe.error);
    if (menu.error) throw toAppError(menu.error);

    const groups = new Map<number, FlexGroup>();
    for (const row of menu.data) {
      const group = groups.get(row.group_key) ?? {
        key: row.group_key, label: row.group_label, min: row.min_choices, max: row.max_choices, options: [],
      };
      group.options.push({ ingredientId: row.ingredient_id, name: row.ingredient_name, inPantry: row.in_pantry, isDefault: row.is_default, selected: row.selected });
      groups.set(row.group_key, group);
    }

    const r = recipe.data;
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      totalMinutes: r.total_minutes ?? 0,
      baseServings: r.base_servings,
      keepsDays: r.keeps_days,
      slots: r.recipe_meal_slots.map((s) => s.slot),
      steps: [...r.recipe_steps].sort((a, b) => a.step_number - b.step_number).map((s) => s.instruction),
      groups: [...groups.values()],
    };
  }

  async preview(id: string, servings: number, choices: Choice[]) {
    const { data, error } = await this.client.rpc('preview_recipe', { p_recipe_id: id, p_servings: servings, p_choices: toJson(choices) });
    if (error) throw toAppError(error);
    const parsed = previewSchema.safeParse(data);
    if (!parsed.success) throw new AppError('unknown', parsed.error);
    return parsed.data;
  }

  async cookNow(id: string, slot: MealSlot, servings: number, choices: Choice[]) {
    const { data, error } = await this.client.rpc('cook_now', {
      p_recipe_id: id, p_slot: slot, p_servings: servings, p_choices: toJson(choices),
    });
    if (error) throw toAppError(error);
    return toCookResult(data);
  }

  async cookPlanned(plannedMealId: string, choices: Choice[]) {
    const { data, error } = await this.client.rpc('cook_planned_meal', { p_planned_meal_id: plannedMealId, p_choices: toJson(choices) });
    if (error) throw toAppError(error);
    return toCookResult(data);
  }

  async undoCook(plannedMealId: string) {
    const { error } = await this.client.rpc('undo_meal_cooked', { p_planned_meal_id: plannedMealId });
    if (error) throw toAppError(error);
  }
}

function toCookResult(data: unknown) {
  const row = data as CookRow;
  return {
    plannedMealId: row.planned_meal_id,
    shortfall: row.shortfall.map((s) => ({ ingredientId: s.ingredient_id, name: s.ingredient_name, missingGrams: s.missing_g })),
  };
}
