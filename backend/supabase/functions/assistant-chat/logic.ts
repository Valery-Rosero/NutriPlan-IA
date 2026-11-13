// Lógica pura del asistente (sin red ni base): prompt, validación de la respuesta y respaldo.
// "El LLM propone, la BD dispone" (ADR-003, ADR-029): nada de lo que diga el modelo se aplica sin validar aquí
// y después en la base (create_assistant_recipe, apply_assistant_suggestion).
import { z } from 'npm:zod@4';

/** Receta del recetario, ya segura para la persona (cook_with_what_i_have). */
export type Candidate = {
  recipe_id: string;
  title: string;
  total_minutes: number;
  coverage: number;
  missing: { ingredient_name?: string; name?: string }[] | null;
  uses_expiring: boolean;
};

/** Ingrediente del catálogo que la persona SÍ puede comer (assistant_ingredients). */
export type SafeIngredient = { ingredient_id: string; name: string; in_pantry: boolean; expiring: boolean; is_staple: boolean };

export type Target = { planned_meal_id: string; slot: string; current_title: string } | null;

/** Receta nueva tal como la recibe create_assistant_recipe. */
export type NewRecipe = {
  title: string;
  description: string | null;
  slot: string;
  servings: number;
  prep_minutes: number;
  cook_minutes: number;
  ingredients: { ingredient_id: string; grams: number }[];
  steps: string[];
};

export type Pick = { kind: 'catalog'; recipeId: string } | { kind: 'new'; recipe: NewRecipe };

export type Decision = { reply: string; picks: Pick[]; fallback: boolean };

export type Context = {
  slot: string;
  candidates: Candidate[];
  ingredients: SafeIngredient[];
  target: Target;
  /** Porciones por defecto (tamaño del hogar). */
  servings: number;
};

export const MAX_OPTIONS = 3;

export const requestSchema = z.object({
  conversation_id: z.uuid().optional(),
  message: z.string().trim().min(1).max(1000),
  planned_meal_id: z.uuid().optional(),
});

const newRecipeSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(300).nullable().optional(),
  servings: z.number().int().min(1).max(12).optional(),
  prep_minutes: z.number().int().min(0).max(180),
  cook_minutes: z.number().int().min(0).max(240),
  ingredients: z.array(z.object({ ref: z.string(), grams: z.number().min(1).max(3000) })).min(1).max(15),
  steps: z.array(z.string().trim().min(3).max(400)).min(1).max(12),
});

const answerSchema = z.object({
  reply: z.string().trim().min(1).max(1500),
  pantry_only: z.boolean().optional().default(false),
  options: z
    .array(z.object({ kind: z.enum(['catalog', 'new']), ref: z.string().nullable().optional(), recipe: z.unknown().optional() }))
    .optional()
    .default([]),
});

const SLOT_NAMES: Record<string, string> = { breakfast: 'desayuno', lunch: 'almuerzo', dinner: 'cena', snack: 'algo' };

export const missingNames = (c: Candidate) =>
  (c.missing ?? []).map((m) => m.ingredient_name ?? m.name).filter((n): n is string => !!n);

/** Referencias cortas para el modelo (R1…, I1…): no puede "acertar" un id largo de la base por casualidad. */
const recipeRef = (i: number) => `R${i + 1}`;
const ingredientRef = (i: number) => `I${i + 1}`;

/**
 * Instrucciones del sistema. A propósito NO incluye alergias, dietas ni datos de salud (ADR-025): las recetas
 * y los ingredientes ya vienen filtrados por la base, así que el modelo no necesita conocerlos.
 */
export function systemPrompt({ slot, candidates, ingredients, target, servings }: Context): string {
  const recipes = candidates
    .map((c, i) => {
      const missing = missingNames(c);
      return `${recipeRef(i)} | ${c.title} | ${c.total_minutes} min | tiene ${Math.round(c.coverage * 100)}%` +
        (missing.length ? ` | le falta: ${missing.join(', ')}` : ' | tiene todo') +
        (c.uses_expiring ? ' | usa algo que vence pronto' : '');
    })
    .join('\n');
  const pantry = ingredients
    .map((g, i) =>
      `${ingredientRef(i)} ${g.name} (` +
      (g.is_staple ? 'básico de cocina' : g.in_pantry ? (g.expiring ? 'en su cocina, vence pronto' : 'en su cocina') : 'hay que comprarlo') +
      ')')
    .join('\n');
  return [
    'Eres el asistente de cocina de NutriPlan, una app para familias y estudiantes de Pasto, Colombia.',
    'Estilo: cálido, alegre y claro, en español de Colombia. Tuteas. Máximo 120 palabras.',
    'Escribe en Markdown sencillo: **negrita** para el nombre de cada plato, listas con "- " y uno que otro emoji de comida.',
    'No sabes el género de la persona: no uses apodos ni palabras con género (nada de "mijo", "mija", "amigo", "amiga", "querida").',
    `Momento del día: ${SLOT_NAMES[slot] ?? slot}. Porciones por defecto: ${servings}.`,
    target ? `La persona quiere cambiar su ${SLOT_NAMES[target.slot] ?? target.slot}: hoy tiene "${target.current_title}". No vuelvas a proponer ese plato.` : '',
    'RECETARIO (recetas ya revisadas; usa la referencia exacta R…):',
    recipes || '(vacío)',
    'INGREDIENTES que puedes usar para inventar recetas nuevas (son los ÚNICOS permitidos; usa la referencia exacta I…):',
    pantry || '(ninguno)',
    'Qué hacer:',
    `- Propón entre 1 y ${MAX_OPTIONS} opciones en "options". Mezcla recetas del recetario (kind "catalog" con su ref R…) y recetas tuyas nuevas (kind "new" con "recipe") cuando ayuden, por ejemplo si el recetario no tiene algo que encaje con lo que pide o con lo que hay.`,
    '- Una receta nueva: título corto y antojador; de 2 a 10 ingredientes de la lista I con los gramos TOTALES para las porciones; de 2 a 8 pasos cortos, en imperativo y tuteando; minutos realistas. Prefiere lo que está en su cocina y lo que vence pronto; si hay que comprar, que sea poco y común.',
    '- En "reply" presenta las opciones (una línea por opción, con su nombre en negrita) y cierra con una pregunta corta. Las tarjetas muestran ingredientes y pasos: no los repitas en el texto.',
    '- Si rechaza un ingrediente o plato ("no quiero lentejas"), no lo uses en ninguna opción.',
    '- Si pide usar SOLO lo que tiene, marca pantry_only=true: solo recetas del recetario con "tiene todo" o recetas nuevas hechas solo con ingredientes "en su cocina" o "básico de cocina".',
    '- Si pide algo con un ingrediente que no está en la lista I, dile con cariño que no lo puedes usar y propón otra cosa.',
    '- Nunca inventes referencias ni ingredientes fuera de la lista.',
    '- No das consejo médico ni diagnósticos: si preguntan algo de salud, di que lo consulten con un profesional y no propongas opciones.',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Valida lo que devolvió el modelo. Cada opción inválida se descarta (referencia inventada, ingrediente fuera de
 * la lista, receta mal formada, faltantes cuando pidió solo lo que tiene). Devuelve null si propuso opciones y
 * ninguna sirve, o si la forma es inválida: entonces se usa el respaldo.
 */
export function validateAnswer(raw: unknown, ctx: Context): Decision | null {
  const parsed = answerSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { reply, pantry_only, options } = parsed.data;
  if (options.length === 0) return { reply, picks: [], fallback: false }; // p. ej. una pregunta de salud

  const picks: Pick[] = [];
  let droppedForMissing = false;
  for (const option of options.slice(0, MAX_OPTIONS)) {
    if (option.kind === 'catalog') {
      const index = option.ref ? Number(option.ref.replace(/^R/i, '')) - 1 : -1;
      const chosen = ctx.candidates[index];
      if (!chosen || (ctx.target && chosen.title === ctx.target.current_title)) continue;
      if (picks.some((p) => p.kind === 'catalog' && p.recipeId === chosen.recipe_id)) continue;
      // US-160: "solo con lo que tengo" no admite recetas con faltantes, aunque el modelo las elija.
      if (pantry_only && missingNames(chosen).length > 0) {
        droppedForMissing = true;
        continue;
      }
      picks.push({ kind: 'catalog', recipeId: chosen.recipe_id });
    } else {
      const recipe = toNewRecipe(option.recipe, ctx);
      if (!recipe) continue;
      if (pantry_only && recipe.ingredients.some((g) => !ctx.ingredients.find((s) => s.ingredient_id === g.ingredient_id)?.in_pantry)) {
        droppedForMissing = true;
        continue;
      }
      picks.push({ kind: 'new', recipe });
    }
  }

  if (picks.length > 0) return { reply, picks, fallback: false };
  if (pantry_only && droppedForMissing) {
    const closest = [...ctx.candidates].sort((a, b) => b.coverage - a.coverage)[0];
    const missing = closest ? missingNames(closest) : [];
    return {
      reply: missing.length
        ? `No tengo una receta completa solo con tu cocina: para **${closest.title}** te falta ${missing.join(', ')}. ¿Te la propongo igual?`
        : 'No tengo una receta completa solo con tu cocina en este momento. ¿Quieres que incluya algo para comprar?',
      picks: [],
      fallback: false,
    };
  }
  return null;
}

/** Traduce una receta nueva del modelo (refs I…) a la que valida la base; null si no sirve. */
function toNewRecipe(raw: unknown, ctx: Context): NewRecipe | null {
  const parsed = newRecipeSchema.safeParse(raw);
  if (!parsed.success) return null;
  const r = parsed.data;
  const ingredients: NewRecipe['ingredients'] = [];
  for (const line of r.ingredients) {
    const safe = ctx.ingredients[Number(line.ref.replace(/^I/i, '')) - 1];
    if (!safe) return null; // fuera de la lista permitida: toda la receta se descarta
    if (ingredients.some((g) => g.ingredient_id === safe.ingredient_id)) return null;
    ingredients.push({ ingredient_id: safe.ingredient_id, grams: Math.round(line.grams) });
  }
  if (r.prep_minutes + r.cook_minutes < 1) return null;
  return {
    title: r.title,
    description: r.description ?? null,
    slot: ctx.target?.slot ?? ctx.slot,
    servings: r.servings ?? ctx.servings,
    prep_minutes: r.prep_minutes,
    cook_minutes: r.cook_minutes,
    ingredients,
    steps: r.steps,
  };
}

/** Lo que muestra la tarjeta de una receta nueva: cuánto hay en la cocina y qué falta. */
export function newRecipeSummary(recipe: NewRecipe, ingredients: SafeIngredient[]) {
  const lines = recipe.ingredients.map((g) => ingredients.find((s) => s.ingredient_id === g.ingredient_id)!);
  const have = lines.filter((s) => s.in_pantry).length;
  return {
    totalMinutes: recipe.prep_minutes + recipe.cook_minutes,
    coverage: lines.length ? Math.round((have / lines.length) * 100) / 100 : 0,
    missing: lines.filter((s) => !s.in_pantry).map((s) => s.name),
  };
}

/** Sin modelo (falla, sin clave o tiempo agotado) igual se responde: la candidata con más de la despensa. */
export function fallbackDecision(candidates: Candidate[], target: Target): Decision {
  const pool = target ? candidates.filter((c) => c.title !== target.current_title) : candidates;
  const best = [...pool].sort((a, b) => b.coverage - a.coverage || a.total_minutes - b.total_minutes)[0];
  if (!best) {
    return { reply: 'No encontré recetas que cumplan tus restricciones para este momento. Prueba agregando ingredientes a tu cocina.', picks: [], fallback: true };
  }
  const missing = missingNames(best);
  return {
    reply: `Te propongo **${best.title}** (${best.total_minutes} min)` + (missing.length ? `; te falta ${missing.join(', ')}.` : ', y tienes todo lo necesario.'),
    picks: [{ kind: 'catalog', recipeId: best.recipe_id }],
    fallback: true,
  };
}

/** Momento del día en Colombia (UTC−5, sin horario de verano), igual que momentOfDay en la app. */
export function slotForNow(now = new Date()): string {
  const hour = (now.getUTCHours() + 24 - 5) % 24;
  return hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 18 ? 'snack' : 'dinner';
}
