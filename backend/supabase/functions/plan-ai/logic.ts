// Lógica pura de plan-ai (ADR-039): qué platos pedir, cómo validarlos y cómo repartirlos en los días.
// La IA propone los platos y escribe las recetas; la base valida cada receta y cada comida.
import { z } from 'npm:zod@4';

import {
  foodKey,
  ingredientRule,
  mentionsAvoided,
  pantryLines,
  profileLines,
  STYLE,
  validateRecipeAnswer,
  type NewRecipe,
  type RecipeContext,
} from '../_shared/recipe-ai.ts';

export type DishKind = 'breakfast' | 'main';
/** Un plato del menú (paso 1). */
export type Dish = { title: string; blurb: string; kind: DishKind; minutes: number; uses_expiring: boolean };
/** Un plato ya convertido en receta (paso 2), listo para repartir (paso 3). */
export type PlanDish = { recipe_id: string; kind: DishKind; expiring: boolean; coverage: number };
export type PlannedMealInput = { meal_date: string; slot: string; recipe_id: string; reason_code: string };

const MAIN_SLOTS = ['lunch', 'dinner'];
const SLOTS = ['breakfast', 'lunch', 'dinner'] as const;
export const MAX_RECIPES_PER_CALL = 4;

const slotsSchema = z.array(z.enum(SLOTS)).min(1).max(3);
const dishSchema = z.object({
  title: z.string().trim().min(3).max(80),
  blurb: z.string().trim().max(140).default(''),
  kind: z.enum(['breakfast', 'main']),
  minutes: z.number().int().min(1).max(240),
  uses_expiring: z.boolean().optional().default(false),
});

export const requestSchema = z.union([
  z.object({ action: z.literal('menu'), days: z.number().int().min(1).max(31), slots: slotsSchema }),
  z.object({ action: z.literal('recipes'), slots: slotsSchema, dishes: z.array(dishSchema).min(1).max(MAX_RECIPES_PER_CALL) }),
  z.object({
    action: z.literal('save'),
    start: z.iso.date(),
    days: z.number().int().min(1).max(31),
    slots: slotsSchema,
    dishes: z
      .array(z.object({ recipe_id: z.uuid(), kind: z.enum(['breakfast', 'main']), expiring: z.boolean(), coverage: z.number().min(0).max(1) }))
      .min(1)
      .max(40),
  }),
]);

/**
 * Cuántos platos distintos pedir: unos 12 en la semana (4 desayunos y 8 almuerzos o cenas) y, para el mes, dos
 * semanas que rotan (6 y 14). Nunca más que los momentos a llenar.
 */
export function menuCounts(days: number, slots: string[]) {
  const breakfastSlots = slots.includes('breakfast') ? days : 0;
  const mainSlots = slots.filter((s) => MAIN_SLOTS.includes(s)).length * days;
  const long = days > 7;
  return {
    breakfast: Math.min(breakfastSlots, long ? 6 : 4),
    main: Math.min(mainSlots, long ? 14 : 8),
  };
}

/** Paso 1: el menú (platos con nombre, frase y minutos; sin recetas todavía). */
export function menuPrompt(ctx: RecipeContext, counts: { breakfast: number; main: number }, days: number): string {
  const inPantry = ctx.ingredients.filter((g) => g.in_pantry && !g.is_staple);
  const expiring = ctx.ingredients.filter((g) => g.expiring);
  return [
    ...STYLE,
    `Vas a armar el menú de ${days === 1 ? 'un día' : `${days} días`} para esta persona.`,
    'LO QUE SABES DE LA PERSONA:',
    ...profileLines(ctx.profile),
    ctx.profile.restricted
      ? 'Solo se pueden usar ingredientes de esta lista (son los únicos seguros para la persona):'
      : 'Puede usar cualquier ingrediente común en Colombia. Lista de referencia (prefiere lo de su cocina y lo que vence):',
    pantryLines(ctx.ingredients) || '(ninguno)',
    inPantry.length ? `Tiene en su cocina: ${inPantry.map((g) => g.name).join(', ')}.` : 'Su cocina está casi vacía.',
    expiring.length ? `Vence pronto (úsalo en los primeros platos): ${expiring.map((g) => g.name).join(', ')}.` : '',
    'Qué hacer:',
    counts.breakfast ? `- ${counts.breakfast} desayunos (kind "breakfast"), distintos entre sí.` : '',
    counts.main ? `- ${counts.main} platos para almuerzo o cena (kind "main"), distintos entre sí: varía la proteína (pollo, res, cerdo, pescado, huevo, granos) y la preparación (sudado, asado, guiso, sopa, arroz, frito, al horno). Platos de verdad que una familia sirve en la mesa, que rindan.` : '',
    '- Cada plato: "title" corto y antojador; "blurb" UNA frase de máximo 90 caracteres que diga por qué le sirve (lo que tiene, lo que vence, lo rápido, lo rendidor, lo típico); "minutes" el total realista; "uses_expiring" true si usa algo que vence pronto.',
    '- Usa primero lo que tiene en su cocina y lo que vence; si hay que comprar, que sea poco, común y económico.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Valida el menú: quita repetidos, lo que pasa su tiempo máximo y lo que menciona algo de "no usar". */
export function validateMenu(raw: unknown, ctx: RecipeContext, counts: { breakfast: number; main: number }): Dish[] {
  const parsed = z.object({ dishes: z.array(z.unknown()).default([]) }).safeParse(raw);
  if (!parsed.success) return [];
  const max = ctx.profile.max_minutes ?? 240;
  const out: Dish[] = [];
  for (const item of parsed.data.dishes) {
    const d = dishSchema.safeParse(item);
    if (!d.success) continue;
    const dish = { ...d.data, title: d.data.title.replace(/\*+/g, '').trim(), blurb: d.data.blurb.replace(/\*+/g, '').trim() };
    if (dish.minutes > max) continue;
    if (out.some((o) => foodKey(o.title) === foodKey(dish.title))) continue;
    if (mentionsAvoided(`${dish.title} ${dish.blurb}`, ctx.profile.avoid)) continue;
    if (out.filter((o) => o.kind === dish.kind).length >= counts[dish.kind]) continue;
    out.push(dish);
  }
  return out;
}

/** ¿Alcanza para armar el plan? Al menos 1 desayuno (si se pidieron) y 2 platos fuertes (si se pidieron). */
export function menuIsEnough(dishes: Pick<Dish, 'kind'>[], counts: { breakfast: number; main: number }) {
  const breakfast = dishes.filter((d) => d.kind === 'breakfast').length;
  const main = dishes.filter((d) => d.kind === 'main').length;
  return (counts.breakfast === 0 || breakfast >= 1) && (counts.main === 0 || main >= Math.min(2, counts.main));
}

/** Paso 2: las recetas de hasta 4 platos en una sola llamada. */
export function recipesPrompt(ctx: RecipeContext, dishes: Dish[]): string {
  return [
    ...STYLE,
    `Escribe la receta completa de cada plato, en el mismo orden, para ${ctx.profile.servings} ${ctx.profile.servings === 1 ? 'porción' : 'porciones'} (gramos TOTALES para esas porciones):`,
    ...dishes.map((d, i) => `${i + 1}. «${d.title}»: ${d.blurb}`),
    'LO QUE SABES DE LA PERSONA:',
    ...profileLines(ctx.profile),
    ingredientRule(ctx.profile),
    pantryLines(ctx.ingredients) || '(ninguno)',
    'Plantilla de cada receta: de 3 a 12 ingredientes con gramos realistas; de 3 a 8 pasos cortos, en imperativo y tuteando; prep_minutes y cook_minutes realistas' +
      (ctx.profile.max_minutes ? ` (la suma no pasa de ${ctx.profile.max_minutes}).` : '.'),
  ].join('\n');
}

/** Momentos del día en que va una receta: el desayuno en el desayuno; un plato fuerte en almuerzo y cena pedidos. */
export function slotsFor(kind: DishKind, slots: string[]): string[] {
  return kind === 'breakfast' ? ['breakfast'] : slots.filter((s) => MAIN_SLOTS.includes(s));
}

/** Valida las recetas de una llamada; cada una con su plato (null si esa no sirve). */
export function validateRecipes(raw: unknown, ctx: RecipeContext, dishes: Dish[], slots: string[]): (NewRecipe | null)[] {
  const parsed = z.object({ recipes: z.array(z.unknown()).default([]) }).safeParse(raw);
  const list = parsed.success ? parsed.data.recipes : [];
  return dishes.map((dish, i) => {
    const forDish = slotsFor(dish.kind, slots);
    if (forDish.length === 0) return null;
    return validateRecipeAnswer(list[i], ctx, { title: dish.title, blurb: dish.blurb, slot: forDish[0], slots: forDish });
  });
}

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * Paso 3: reparte los platos en los días. Para cada día y momento elige el plato de ese tipo que menos va, que no
 * esté ya ese día ni haya ido el día anterior (nunca el mismo dos días seguidos, si hay con qué); lo que vence va
 * primero. Lo ya cocinado se respeta (`cooked`: "AAAA-MM-DD|slot").
 */
export function schedule(start: string, days: number, slots: string[], dishes: PlanDish[], cooked: Set<string> = new Set()): PlannedMealInput[] {
  const ordered = [...dishes].sort((a, b) => Number(b.expiring) - Number(a.expiring) || b.coverage - a.coverage);
  const uses = new Map<string, number>();
  const lastDay = new Map<string, number>();
  const meals: PlannedMealInput[] = [];
  const order = SLOTS.filter((s) => slots.includes(s));
  for (let d = 0; d < days; d++) {
    const date = addDays(start, d);
    const today = new Set<string>();
    for (const slot of order) {
      if (cooked.has(`${date}|${slot}`)) continue;
      const kind: DishKind = slot === 'breakfast' ? 'breakfast' : 'main';
      const pool = ordered.filter((x) => x.kind === kind);
      if (pool.length === 0) continue;
      const fresh = pool.filter((x) => !today.has(x.recipe_id) && lastDay.get(x.recipe_id) !== d - 1);
      const candidates = fresh.length ? fresh : pool.filter((x) => !today.has(x.recipe_id)).length ? pool.filter((x) => !today.has(x.recipe_id)) : pool;
      const pick = candidates.reduce((best, x) => ((uses.get(x.recipe_id) ?? 0) < (uses.get(best.recipe_id) ?? 0) ? x : best));
      const n = uses.get(pick.recipe_id) ?? 0;
      uses.set(pick.recipe_id, n + 1);
      lastDay.set(pick.recipe_id, d);
      today.add(pick.recipe_id);
      meals.push({
        meal_date: date,
        slot,
        recipe_id: pick.recipe_id,
        reason_code: pick.expiring && n === 0 ? 'pantry_expiring' : pick.coverage >= 0.5 ? 'pantry_match' : 'ai_pick',
      });
    }
  }
  return meals;
}
