import { z } from 'zod';

import type { MealSlot, MissingIngredient } from '@/features/cooking/domain/cooking';

export type FlexOption = { ingredientId: string; name: string; inPantry: boolean; isDefault: boolean; selected: boolean };
export type FlexGroup = { key: number; label: string; min: number; max: number; options: FlexOption[] };

export type RecipeDetail = {
  id: string;
  title: string;
  description: string | null;
  totalMinutes: number;
  baseServings: number;
  keepsDays: number | null;
  slots: MealSlot[];
  steps: string[];
  /** Solo opciones seguras para quien consulta (las filtra la base). */
  groups: FlexGroup[];
};

export type Choice = { groupKey: number; ingredientId: string };

// La respuesta de preview_recipe se valida (convenciones: toda respuesta externa pasa por Zod).
export const previewSchema = z.object({
  lines: z.array(
    z.object({
      ingredient_id: z.string(),
      ingredient_name: z.string(),
      quantity: z.number(),
      unit_code: z.string(),
      grams: z.number(),
      is_optional: z.boolean(),
      group_key: z.number().nullable(),
      group_label: z.string().nullable(),
      in_pantry: z.boolean(),
    }),
  ),
  per_serving: z
    .object({
      kcal: z.number(), protein_g: z.number(), carbs_g: z.number(), fat_g: z.number(),
      fiber_g: z.number(), sugar_g: z.number(), sodium_mg: z.number(),
    })
    .nullable(),
  allergens: z.array(z.string()),
});
export type RecipePreview = z.infer<typeof previewSchema>;

export type CookResult = { plannedMealId: string; shortfall: MissingIngredient[] };

/** Puerto de recetas. Falla con AppError. */
export interface RecipeRepository {
  getDetail(id: string): Promise<RecipeDetail>;
  /** Cantidades escaladas, nutrición y alérgenos calculados en la base (nunca en la app). */
  preview(id: string, servings: number, choices: Choice[]): Promise<RecipePreview>;
  cookNow(id: string, slot: MealSlot, servings: number, choices: Choice[]): Promise<CookResult>;
  /** Cocinar una comida ya planeada, con las opciones elegidas (atómico). */
  cookPlanned(plannedMealId: string, choices: Choice[]): Promise<CookResult>;
  undoCook(plannedMealId: string): Promise<void>;
}

/**
 * Elegir/quitar una opción respetando el máximo del grupo:
 * con máximo 1 reemplaza; con más, si se llena, sale la elegida hace más tiempo.
 */
export function toggleChoice(choices: Choice[], group: FlexGroup, ingredientId: string): Choice[] {
  const inGroup = choices.filter((c) => c.groupKey === group.key);
  const others = choices.filter((c) => c.groupKey !== group.key);
  if (inGroup.some((c) => c.ingredientId === ingredientId)) {
    // No se puede bajar del mínimo quitando: se queda como está.
    return inGroup.length <= Math.max(group.min, 1) && group.min > 0
      ? choices
      : [...others, ...inGroup.filter((c) => c.ingredientId !== ingredientId)];
  }
  const next = [...inGroup, { groupKey: group.key, ingredientId }];
  return [...others, ...next.slice(Math.max(0, next.length - group.max))];
}

/** Selección inicial: lo que la base resolvió con la despensa (opciones marcadas `selected`). */
export function initialChoices(groups: FlexGroup[]): Choice[] {
  return groups.flatMap((g) => g.options.filter((o) => o.selected).map((o) => ({ groupKey: g.key, ingredientId: o.ingredientId })));
}

const SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner'];

/** Momento del día para "Cocinar ahora" según la hora; si la receta no sirve para él, el siguiente que sí. */
export function slotForNow(recipeSlots: MealSlot[], hour: number): MealSlot {
  const byHour: MealSlot = hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 18 ? 'snack' : 'dinner';
  if (recipeSlots.includes(byHour)) return byHour;
  const start = SLOT_ORDER.indexOf(byHour);
  const rotated = [...SLOT_ORDER.slice(start), ...SLOT_ORDER.slice(0, start)];
  return rotated.find((s) => recipeSlots.includes(s)) ?? recipeSlots[0] ?? 'lunch';
}
