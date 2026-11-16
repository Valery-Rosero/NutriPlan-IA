// Recetas hechas por la IA, compartido por assistant-chat (ADR-037) y plan-ai (ADR-039): lo que la IA sabe de la
// persona, la lista de ingredientes y cómo se valida una receta antes de pasarla a create_assistant_recipe.
// "El LLM propone, la BD dispone": nada de aquí reemplaza la validación de la base.
import { z } from 'npm:zod@4';

/** Ingrediente del catálogo que la persona SÍ puede comer (assistant_ingredients). */
export type SafeIngredient = { ingredient_id: string; name: string; in_pantry: boolean; expiring: boolean; is_staple: boolean };

/** Lo que la IA sabe de la persona (assistant_profile). Sin nombres de alergias, dietas ni datos de salud. */
export type AssistantProfile = {
  servings: number;
  max_minutes: number | null;
  /** 0 nada de picante … 3 picante. */
  spice: number;
  budget: 'tight' | 'normal' | null;
  cuisines: string[];
  /** Alergias, dietas y lo que no le gusta, mezclado y sin el porqué. */
  avoid: string[];
  /** Tiene alergias o dietas: la receta solo puede llevar ingredientes del catálogo (la base los revisa). */
  restricted: boolean;
};

export const DEFAULT_PROFILE: AssistantProfile = {
  servings: 2, max_minutes: null, spice: 2, budget: null, cuisines: [], avoid: [], restricted: false,
};

/** Una línea de ingrediente de la receta que se le pasa a create_assistant_recipe. */
export type RecipeLine = { ingredient_id: string; grams: number } | { name: string; grams: number };

/** Receta nueva tal como la recibe create_assistant_recipe. `slots`: para varios momentos (almuerzo y cena). */
export type NewRecipe = {
  title: string;
  description: string | null;
  slot: string;
  slots?: string[];
  servings: number;
  prep_minutes: number;
  cook_minutes: number;
  ingredients: RecipeLine[];
  steps: string[];
};

export type RecipeContext = { ingredients: SafeIngredient[]; profile: AssistantProfile };

/** Lo que devuelve la IA al llenar la plantilla de una receta. */
export const recipeAnswerSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(300).nullable().optional(),
  servings: z.number().int().min(1).max(12).optional(),
  prep_minutes: z.number().int().min(0).max(180),
  cook_minutes: z.number().int().min(0).max(240),
  ingredients: z
    .array(z.object({ ref: z.string().nullable().optional(), name: z.string().nullable().optional(), grams: z.number().min(1).max(3000) }))
    .min(2)
    .max(15),
  steps: z.array(z.string().trim().min(3).max(400)).min(2).max(12),
});

/** El mismo esquema en el formato de responseSchema de Gemini. */
export const RECIPE_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    description: { type: 'STRING', nullable: true, description: 'Una frase que antoje.' },
    servings: { type: 'INTEGER' },
    prep_minutes: { type: 'INTEGER' },
    cook_minutes: { type: 'INTEGER' },
    ingredients: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          ref: { type: 'STRING', nullable: true, description: 'Referencia exacta I… si está en la lista.' },
          name: { type: 'STRING', nullable: true, description: 'Nombre común, solo si no está en la lista.' },
          grams: { type: 'NUMBER', description: 'Gramos totales para las porciones.' },
        },
        required: ['grams'],
      },
    },
    steps: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['title', 'servings', 'prep_minutes', 'cook_minutes', 'ingredients', 'steps'],
};

const SPICE = ['nada de picante', 'picante suave', 'picante medio', 'le gusta el picante'];

/** Igual que food_key en la base: sin tildes, minúsculas, solo letras y números. */
export const foodKey = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** ¿El texto menciona algo de la lista "no usar"? ("Arroz con maní" con "Maní" → sí). Plural simple incluido. */
export function mentionsAvoided(text: string, avoid: string[]): boolean {
  const words = ` ${foodKey(text)} `;
  return avoid.some((a) => {
    const k = foodKey(a);
    if (!k) return false;
    const singular = k.replace(/(es|s)$/, '');
    return words.includes(` ${k} `) || (singular.length > 2 && new RegExp(` ${singular}(es|s)? `).test(words));
  });
}

/** Lo que la IA sabe de la persona, en frases (ADR-037). Nunca nombra alergias ni dietas. */
export function profileLines(p: AssistantProfile): string[] {
  return [
    `Cocina para ${p.servings} ${p.servings === 1 ? 'persona' : 'personas'}.`,
    p.max_minutes ? `Tiempo máximo por receta: ${p.max_minutes} minutos (en total).` : '',
    `Picante: ${SPICE[p.spice] ?? SPICE[2]}.`,
    p.budget === 'tight' ? 'Presupuesto ajustado: prefiere ingredientes económicos y rendidores.' : '',
    p.cuisines.length ? `Cocinas que le gustan: ${p.cuisines.join(', ')} (que la mayoría vaya por ahí).` : '',
    p.avoid.length
      ? `NO USES NUNCA, ni en los platos ni en las recetas: ${p.avoid.join(', ')}. No expliques por qué ni lo menciones.`
      : '',
  ].filter(Boolean);
}

/** Referencias cortas para el modelo (I1…): no puede "acertar" un id largo de la base por casualidad. */
export const ingredientRef = (i: number) => `I${i + 1}`;

/** La lista de ingredientes con su referencia y si están en la cocina, vencen pronto o hay que comprarlos. */
export function pantryLines(ingredients: SafeIngredient[]) {
  return ingredients
    .map((g, i) =>
      `${ingredientRef(i)} ${g.name} (` +
      (g.is_staple ? 'básico de cocina' : g.in_pantry ? (g.expiring ? 'en su cocina, vence pronto' : 'en su cocina') : 'hay que comprarlo') +
      ')')
    .join('\n');
}

/** Cómo usar los ingredientes según haya o no restricciones (ADR-037, opción A). */
export function ingredientRule(profile: AssistantProfile) {
  return profile.restricted
    ? 'INGREDIENTES: usa SOLO los de esta lista, cada uno con su referencia exacta en "ref" (I…). Nada fuera de la lista.'
    : 'INGREDIENTES: si el ingrediente está en esta lista, pon su referencia exacta en "ref" (I…). Si no está, deja "ref" vacío y escribe su nombre común en "name" (sin marcas). Al menos uno debe ser de la lista.';
}

export const STYLE = [
  'Eres el asistente de cocina de NutriPlan, una app para familias y estudiantes de Pasto, Colombia.',
  'Estilo: cálido, alegre y claro, en español de Colombia. Tuteas.',
  'No sabes el género de la persona: no uses apodos ni palabras con género (nada de "mijo", "mija", "amigo", "amiga", "querida").',
];

/**
 * Valida una receta de la IA y la traduce a lo que recibe create_assistant_recipe. null si no sirve: referencia
 * inventada, algo de "no usar", ingrediente libre con restricciones, repetidos o más tiempo del máximo.
 */
export function validateRecipeAnswer(
  raw: unknown,
  ctx: RecipeContext,
  dish: { title: string; blurb: string; slot: string; slots?: string[] },
): NewRecipe | null {
  const parsed = recipeAnswerSchema.safeParse(raw);
  if (!parsed.success) return null;
  const r = parsed.data;
  const { profile } = ctx;
  const lines: RecipeLine[] = [];
  const seen = new Set<string>();
  for (const line of r.ingredients) {
    const byRef = line.ref ? ctx.ingredients[Number(line.ref.replace(/^I/i, '')) - 1] : undefined;
    if (line.ref && !byRef) return null; // referencia inventada
    // Un nombre que coincide con la lista cuenta como ese ingrediente (la base hace lo mismo con match_ingredient).
    const byName = !byRef && line.name ? ctx.ingredients.find((g) => foodKey(g.name) === foodKey(line.name!)) : undefined;
    const safe = byRef ?? byName;
    const name = safe?.name ?? line.name?.trim() ?? '';
    if (!name || mentionsAvoided(name, profile.avoid)) return null;
    if (safe) {
      if (seen.has(safe.ingredient_id)) return null;
      seen.add(safe.ingredient_id);
      lines.push({ ingredient_id: safe.ingredient_id, grams: Math.round(line.grams) });
    } else {
      if (profile.restricted) return null; // con alergias o dietas, nada fuera del catálogo
      if (name.length < 2 || name.length > 60 || seen.has(foodKey(name))) return null;
      seen.add(foodKey(name));
      lines.push({ name, grams: Math.round(line.grams) });
    }
  }
  if (!lines.some((l) => 'ingredient_id' in l)) return null;
  if (r.prep_minutes + r.cook_minutes < 1) return null;
  if (profile.max_minutes && r.prep_minutes + r.cook_minutes > profile.max_minutes) return null;
  return {
    title: dish.title,
    description: r.description ?? (dish.blurb || null),
    slot: dish.slot,
    ...(dish.slots ? { slots: dish.slots } : {}),
    servings: r.servings ?? profile.servings,
    prep_minutes: r.prep_minutes,
    cook_minutes: r.cook_minutes,
    ingredients: lines,
    steps: r.steps,
  };
}

/** Lo que muestra una receta nueva: cuánto hay en la cocina, qué falta y si usa algo que vence pronto. */
export function newRecipeSummary(recipe: NewRecipe, ingredients: SafeIngredient[]) {
  const names = recipe.ingredients.map((g) => {
    if ('name' in g) return { name: g.name, have: false, expiring: false };
    const safe = ingredients.find((s) => s.ingredient_id === g.ingredient_id);
    return { name: safe?.name ?? '', have: !!safe?.in_pantry, expiring: !!safe?.expiring };
  });
  const have = names.filter((n) => n.have).length;
  return {
    totalMinutes: recipe.prep_minutes + recipe.cook_minutes,
    coverage: names.length ? Math.round((have / names.length) * 100) / 100 : 0,
    missing: names.filter((n) => !n.have && n.name).map((n) => n.name),
    usesExpiring: names.some((n) => n.expiring),
  };
}
