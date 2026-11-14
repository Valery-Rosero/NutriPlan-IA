// Lógica pura del asistente (sin red ni base): prompts, validación de lo que dice el modelo y respaldo.
// "El LLM propone, la BD dispone" (ADR-003, ADR-029, ADR-037): nada de lo que diga el modelo se aplica sin validar
// aquí y después en la base (create_assistant_recipe, apply_assistant_suggestion).
//
// ADR-037 · IA primero, en dos pasos:
//   1. "chat": la IA propone una LISTA de 4–5 platos (nombre, frase, minutos). Nada se guarda como receta.
//   2. "fill": la persona elige uno y la IA llena la plantilla (ingredientes, pasos, porciones, minutos).
// La IA conoce las preferencias de la persona y una lista de "no usar" (alergias, dietas y gustos mezclados, SIN
// el porqué). El recetario queda como respaldo cuando la IA no responde.
import { z } from 'npm:zod@4';

/** Receta del recetario, ya segura para la persona (cook_with_what_i_have). Solo para el respaldo. */
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

/** Un plato de la lista. `recipe_id` solo si es del recetario (respaldo). */
export type Idea = { title: string; blurb: string; minutes: number; recipe_id: string | null };

/** US-174: la persona pidió cambiar varias comidas o la semana. La IA solo traduce la frase; la base calcula. */
export const WEEK_GOALS = ['cheaper', 'faster', 'protein', 'variety', 'use_expiring'] as const;
export type WeekGoal = (typeof WEEK_GOALS)[number];
export type WeekRequest = { goal: WeekGoal | null; avoid: { id: string; name: string }[] };

export type Decision = { reply: string; ideas: Idea[]; fallback: boolean; week?: WeekRequest | null };

/** Una línea de ingrediente de la receta que se le pasa a create_assistant_recipe. */
export type RecipeLine = { ingredient_id: string; grams: number } | { name: string; grams: number };

/** Receta nueva tal como la recibe create_assistant_recipe. */
export type NewRecipe = {
  title: string;
  description: string | null;
  slot: string;
  servings: number;
  prep_minutes: number;
  cook_minutes: number;
  ingredients: RecipeLine[];
  steps: string[];
};

/** Una fila de propose_week_changes (lo que importa para el resumen). */
export type WeekRow = { new_recipe_id: string | null; saving: number | string | null; reason: string };

export type Context = {
  slot: string;
  candidates: Candidate[];
  ingredients: SafeIngredient[];
  target: Target;
  profile: AssistantProfile;
  /** ¿Tiene un plan con comidas? Sin plan no hay semana que cambiar. */
  hasPlan?: boolean;
};

export const MIN_IDEAS = 2;
export const MAX_IDEAS = 5;

export const requestSchema = z.union([
  z.object({
    action: z.literal('fill'),
    conversation_id: z.uuid(),
    message_id: z.number().int().positive(),
    idea: z.number().int().min(0).max(MAX_IDEAS - 1),
  }),
  z.object({
    action: z.literal('chat').optional(),
    conversation_id: z.uuid().optional(),
    message: z.string().trim().min(1).max(1000),
    planned_meal_id: z.uuid().optional(),
  }),
]);

const ideasAnswerSchema = z.object({
  reply: z.string().trim().max(600).optional().default(''),
  ideas: z
    .array(z.object({ title: z.string(), blurb: z.string().optional().default(''), minutes: z.number() }))
    .optional()
    .default([]),
  week: z
    .object({ goal: z.enum(WEEK_GOALS).nullable().optional(), avoid: z.array(z.string()).max(5).optional() })
    .nullable()
    .optional(),
});

const fillAnswerSchema = z.object({
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

const SLOT_NAMES: Record<string, string> = { breakfast: 'desayuno', lunch: 'almuerzo', dinner: 'cena', snack: 'algo' };
const SPICE = ['nada de picante', 'picante suave', 'picante medio', 'le gusta el picante'];

export const missingNames = (c: Candidate) =>
  (c.missing ?? []).map((m) => m.ingredient_name ?? m.name).filter((n): n is string => !!n);

/** Referencias cortas para el modelo (I1…): no puede "acertar" un id largo de la base por casualidad. */
const ingredientRef = (i: number) => `I${i + 1}`;

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

function pantryLines(ingredients: SafeIngredient[]) {
  return ingredients
    .map((g, i) =>
      `${ingredientRef(i)} ${g.name} (` +
      (g.is_staple ? 'básico de cocina' : g.in_pantry ? (g.expiring ? 'en su cocina, vence pronto' : 'en su cocina') : 'hay que comprarlo') +
      ')')
    .join('\n');
}

const STYLE = [
  'Eres el asistente de cocina de NutriPlan, una app para familias y estudiantes de Pasto, Colombia.',
  'Estilo: cálido, alegre y claro, en español de Colombia. Tuteas.',
  'No sabes el género de la persona: no uses apodos ni palabras con género (nada de "mijo", "mija", "amigo", "amiga", "querida").',
];

/** Paso 1: la lista de platos (y el modo semana, US-174). */
export function ideasPrompt(ctx: Context): string {
  const { slot, ingredients, target, profile } = ctx;
  const inPantry = ingredients.filter((g) => g.in_pantry && !g.is_staple);
  return [
    ...STYLE,
    `Momento del día: ${SLOT_NAMES[slot] ?? slot}.`,
    target ? `La persona quiere cambiar su ${SLOT_NAMES[target.slot] ?? target.slot}: hoy tiene "${target.current_title}". No vuelvas a proponer ese plato.` : '',
    'LO QUE SABES DE LA PERSONA:',
    ...profileLines(profile),
    profile.restricted
      ? 'INGREDIENTES: solo puedes usar los de esta lista (son los únicos seguros para la persona; usa la referencia exacta I… cuando se pida):'
      : 'INGREDIENTES: puedes usar cualquier ingrediente común en Colombia. Esta es la lista de referencia (prefiere lo que está en su cocina y lo que vence pronto):',
    pantryLines(ingredients) || '(ninguno)',
    inPantry.length ? `Tiene en su cocina: ${inPantry.map((g) => g.name).join(', ')}.` : 'Su cocina está casi vacía.',
    'Qué hacer:',
    `- Propón ${MAX_IDEAS - 1} o ${MAX_IDEAS} platos en "ideas", DISTINTOS entre sí: varía la proteína y la preparación (no dos ensaladas, no dos sopas, no dos batidos). Platos de verdad que una familia sirve en la mesa; ensaladas o batidos solo si los pide.`,
    '- Cada idea: "title" corto y antojador; "blurb" UNA frase de máximo 90 caracteres que diga por qué le sirve (lo que tiene, lo rápido, lo rendidor, lo típico); "minutes" el total realista.',
    '- En "reply" escribe UNA frase corta y cálida que presente la lista. No repitas los platos: la app los muestra como tarjetas.',
    '- Si rechaza un ingrediente o plato ("no quiero lentejas"), no lo uses en ninguna idea.',
    '- Si pide usar SOLO lo que tiene, que las ideas se hagan con lo de su cocina y los básicos.',
    '- No das consejo médico ni diagnósticos: si preguntan algo de salud, di que lo consulten con un profesional y deja "ideas" vacío.',
    ctx.hasPlan
      ? '- Si pide cambiar VARIAS comidas o toda la semana o el plan ("hazme la semana más barata", "sin lentejas esta semana", "cosas más rápidas", "más proteína", "que no se repita", "usa lo que se me va a dañar"), llena "week" con goal (cheaper, faster, protein, variety, use_expiring o null) y avoid (referencias I… de lo que no quiere), deja "ideas" vacío y en "reply" escribe UNA frase corta y cálida SIN cifras ni nombres de platos: la app calcula y muestra los cambios.'
      : '- Si pide cambiar la semana o el plan, dile con cariño que primero organice su semana en Mi semana; no llenes "week".',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Paso 2: llenar la plantilla de la receta del plato elegido. */
export function fillPrompt(ctx: Context, idea: Idea): string {
  const { profile, ingredients } = ctx;
  const slot = ctx.target?.slot ?? ctx.slot;
  return [
    ...STYLE,
    `Arma la receta completa de «${idea.title}»: ${idea.blurb}`,
    `Es para ${SLOT_NAMES[slot] ?? slot}, para ${profile.servings} ${profile.servings === 1 ? 'porción' : 'porciones'}: los gramos van TOTALES para esas porciones.`,
    'LO QUE SABES DE LA PERSONA:',
    ...profileLines(profile),
    profile.restricted
      ? 'INGREDIENTES: usa SOLO los de esta lista, cada uno con su referencia exacta en "ref" (I…). Nada fuera de la lista.'
      : 'INGREDIENTES: si el ingrediente está en esta lista, pon su referencia exacta en "ref" (I…). Si no está, deja "ref" vacío y escribe su nombre común en "name" (sin marcas). Al menos uno debe ser de la lista.',
    pantryLines(ingredients) || '(ninguno)',
    'Plantilla: de 3 a 12 ingredientes con gramos realistas; de 3 a 8 pasos cortos, en imperativo y tuteando; prep_minutes y cook_minutes realistas' +
      (profile.max_minutes ? ` (la suma no pasa de ${profile.max_minutes}).` : '.'),
    '"description": una frase que antoje. Usa lo que está en su cocina y lo que vence pronto cuando se pueda; si hay que comprar, que sea poco y común.',
  ].join('\n');
}

/**
 * Valida la lista de platos. Descarta lo inválido (sin título, repetido, más largo que su tiempo máximo, con algo
 * de "no usar"). Devuelve null si la forma es inválida o no queda ninguna idea: entonces se usa el respaldo.
 */
export function validateIdeas(raw: unknown, ctx: Context): Decision | null {
  const parsed = ideasAnswerSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { reply, ideas, week } = parsed.data;
  // US-174: pidió cambiar la semana. Las referencias I… se traducen; las inventadas se ignoran.
  if (week && ctx.hasPlan && !ctx.target) {
    const avoid = (week.avoid ?? [])
      .map((ref) => ctx.ingredients[Number(ref.replace(/^I/i, '')) - 1])
      .filter((g): g is SafeIngredient => !!g)
      .map((g) => ({ id: g.ingredient_id, name: g.name }));
    const goal = week.goal ?? null;
    if (goal || avoid.length) return { reply: reply || 'Listo, reviso tu semana.', ideas: [], fallback: false, week: { goal, avoid } };
  }
  if (ideas.length === 0) return reply ? { reply, ideas: [], fallback: false } : null; // p. ej. una pregunta de salud

  const out: Idea[] = [];
  const max = ctx.profile.max_minutes ?? 240;
  for (const i of ideas) {
    const title = i.title.trim().replace(/\*+/g, '').slice(0, 80);
    const blurb = i.blurb.trim().replace(/\*+/g, '').slice(0, 140);
    const minutes = Math.round(i.minutes);
    if (title.length < 3 || minutes < 1 || minutes > max) continue;
    if (ctx.target && foodKey(title) === foodKey(ctx.target.current_title)) continue;
    if (out.some((o) => foodKey(o.title) === foodKey(title))) continue;
    if (mentionsAvoided(`${title} ${blurb}`, ctx.profile.avoid)) continue;
    out.push({ title, blurb, minutes, recipe_id: null });
    if (out.length === MAX_IDEAS) break;
  }
  if (out.length < MIN_IDEAS) return null;
  return { reply: reply || 'Mira estas ideas:', ideas: out, fallback: false };
}

/**
 * Valida la receta del plato elegido y la traduce a lo que recibe create_assistant_recipe. null si no sirve:
 * referencia inventada, algo de "no usar", ingrediente libre con restricciones, repetidos o más tiempo del máximo.
 */
export function validateFill(raw: unknown, ctx: Context, idea: Idea): NewRecipe | null {
  const parsed = fillAnswerSchema.safeParse(raw);
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
    title: idea.title,
    description: r.description ?? (idea.blurb || null),
    slot: ctx.target?.slot ?? ctx.slot,
    servings: r.servings ?? profile.servings,
    prep_minutes: r.prep_minutes,
    cook_minutes: r.cook_minutes,
    ingredients: lines,
    steps: r.steps,
  };
}

/** Lo que muestra la tarjeta de una receta nueva: cuánto hay en la cocina y qué falta (lo libre se compra). */
export function newRecipeSummary(recipe: NewRecipe, ingredients: SafeIngredient[]) {
  const names = recipe.ingredients.map((g) => {
    if ('name' in g) return { name: g.name, have: false };
    const safe = ingredients.find((s) => s.ingredient_id === g.ingredient_id);
    return { name: safe?.name ?? '', have: !!safe?.in_pantry };
  });
  const have = names.filter((n) => n.have).length;
  return {
    totalMinutes: recipe.prep_minutes + recipe.cook_minutes,
    coverage: names.length ? Math.round((have / names.length) * 100) / 100 : 0,
    missing: names.filter((n) => !n.have && n.name).map((n) => n.name),
  };
}

/** Sin modelo (falla, sin clave o tiempo agotado) igual se responde: ideas del recetario (respaldo, ADR-037). */
export function fallbackDecision(candidates: Candidate[], target: Target): Decision {
  const pool = (target ? candidates.filter((c) => c.title !== target.current_title) : candidates)
    .slice()
    .sort((a, b) => b.coverage - a.coverage || a.total_minutes - b.total_minutes)
    .slice(0, MAX_IDEAS);
  if (pool.length === 0) {
    return { reply: 'No encontré recetas que cumplan tus restricciones para este momento. Prueba agregando ingredientes a tu cocina.', ideas: [], fallback: true };
  }
  return {
    reply: 'Ahora no me pude conectar con la IA. Te dejo ideas del recetario:',
    ideas: pool.map((c) => {
      const missing = missingNames(c);
      return {
        title: c.title,
        blurb: missing.length ? `Te falta ${missing.slice(0, 3).join(', ')}.` : 'Tienes todo lo necesario.',
        minutes: c.total_minutes,
        recipe_id: c.recipe_id,
      };
    }),
    fallback: true,
  };
}

const cop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

/**
 * US-174: el resumen con cifras lo arma esto, con lo que calculó la base (la IA nunca pone números).
 * S-6: si no hay nada que cambiar, lo dice claro.
 */
export function weekSummary(rows: WeekRow[]): { text: string; changes: number; saving: number | null; unresolved: number } {
  const changes = rows.filter((r) => r.new_recipe_id).length;
  const unresolved = rows.filter((r) => r.reason === 'avoid_unresolved').length;
  const savings = rows.filter((r) => r.new_recipe_id && r.saving !== null).map((r) => Number(r.saving));
  const saving = savings.length ? savings.reduce((a, b) => a + b, 0) : null;
  const parts: string[] = [];
  if (changes === 0) {
    parts.push('No encontré cambios que mejoren tu semana en eso: con las recetas que son seguras para ti, ya está en lo mejor posible.');
  } else {
    parts.push(`**${changes} ${changes === 1 ? 'cambio' : 'cambios'}** en tu semana` +
      (saving !== null && saving > 0 ? ` · ahorras **${cop(saving)}**` : '') + '. Revísalos antes de aplicar.');
  }
  if (unresolved > 0) {
    parts.push(`Para ${unresolved} ${unresolved === 1 ? 'comida' : 'comidas'} no encontré una receta segura sin lo que pediste evitar.`);
  }
  return { text: parts.join('\n\n'), changes, saving, unresolved };
}

/** Momento del día en Colombia (UTC−5, sin horario de verano), igual que momentOfDay en la app. */
export function slotForNow(now = new Date()): string {
  const hour = (now.getUTCHours() + 24 - 5) % 24;
  return hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 18 ? 'snack' : 'dinner';
}
