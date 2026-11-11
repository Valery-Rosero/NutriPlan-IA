// Lógica pura del asistente (sin red ni base): prompt, validación de la respuesta y respaldo.
// "El LLM propone, la BD dispone" (ADR-003): nada de lo que diga el modelo se aplica sin validar aquí
// y después en apply_assistant_suggestion.
import { z } from 'npm:zod@4';

export type Candidate = {
  recipe_id: string;
  title: string;
  total_minutes: number;
  coverage: number;
  missing: { ingredient_name?: string; name?: string }[] | null;
  uses_expiring: boolean;
};

export type Target = { planned_meal_id: string; slot: string; current_title: string } | null;

export type Decision = {
  reply: string;
  recipeId: string | null;
  fallback: boolean;
};

export const requestSchema = z.object({
  conversation_id: z.uuid().optional(),
  message: z.string().trim().min(1).max(1000),
  planned_meal_id: z.uuid().optional(),
});

const answerSchema = z.object({
  reply: z.string().trim().min(1).max(800),
  recipe_id: z.string().nullable().optional(),
  pantry_only: z.boolean().optional().default(false),
});

const SLOT_NAMES: Record<string, string> = { breakfast: 'desayuno', lunch: 'almuerzo', dinner: 'cena', snack: 'algo' };

export const missingNames = (c: Candidate) =>
  (c.missing ?? []).map((m) => m.ingredient_name ?? m.name).filter((n): n is string => !!n);

/**
 * Instrucciones del sistema. A propósito NO incluye alergias, dietas ni datos de salud (ADR-025):
 * las candidatas ya vienen filtradas por la base, así que el modelo no necesita conocerlos.
 */
export function systemPrompt(slot: string, candidates: Candidate[], target: Target): string {
  const list = candidates
    .map((c) => {
      const missing = missingNames(c);
      return `- id=${c.recipe_id} | ${c.title} | ${c.total_minutes} min | tiene ${Math.round(c.coverage * 100)}%` +
        (missing.length ? ` | le falta: ${missing.join(', ')}` : ' | tiene todo') +
        (c.uses_expiring ? ' | usa algo que vence pronto' : '');
    })
    .join('\n');
  return [
    'Eres el asistente de cocina de NutriPlan, una app para familias y estudiantes de Pasto, Colombia.',
    'Hablas en español de Colombia, cálido y breve (máximo 3 frases). Tuteas.',
    `Momento del día: ${SLOT_NAMES[slot] ?? slot}.`,
    target ? `La persona quiere cambiar su ${SLOT_NAMES[target.slot] ?? target.slot}: hoy tiene "${target.current_title}".` : '',
    'Solo puedes recomendar recetas de esta lista de candidatas (ya son seguras para la persona). Usa el id EXACTO:',
    list || '(no hay candidatas)',
    'Reglas:',
    '- Si la persona rechaza un ingrediente o plato ("no quiero lentejas"), no elijas recetas que lo tengan en el título.',
    '- Si pide usar SOLO lo que tiene, marca pantry_only=true y elige solo recetas con "tiene todo"; si no hay, recipe_id=null y dile qué le falta.',
    '- Si ninguna candidata sirve, recipe_id=null y explica por qué en una frase.',
    '- Nunca inventes recetas, ids ni cantidades.',
    '- No das consejo médico ni diagnósticos: si preguntan algo de salud, di que lo consulten con un profesional.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Valida lo que devolvió el modelo contra las candidatas. Devuelve null si no sirve (se usa el respaldo). */
export function validateAnswer(raw: unknown, candidates: Candidate[]): Decision | null {
  const parsed = answerSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { reply, recipe_id, pantry_only } = parsed.data;
  if (!recipe_id) return { reply, recipeId: null, fallback: false };

  const chosen = candidates.find((c) => c.recipe_id === recipe_id);
  if (!chosen) return null; // id inventado: no se confía en esa respuesta
  // US-160: "solo con lo que tengo" no admite recetas con faltantes, aunque el modelo las elija.
  if (pantry_only && missingNames(chosen).length > 0) {
    const closest = [...candidates].sort((a, b) => b.coverage - a.coverage)[0];
    const missing = closest ? missingNames(closest) : [];
    return {
      reply: missing.length
        ? `No tengo una receta completa solo con tu cocina: para "${closest.title}" te falta ${missing.join(', ')}.`
        : 'No tengo una receta completa solo con tu cocina en este momento.',
      recipeId: null,
      fallback: false,
    };
  }
  return { reply, recipeId: recipe_id, fallback: false };
}

/** Sin modelo (falla, sin clave o tiempo agotado) igual se responde: la candidata con más de la despensa. */
export function fallbackDecision(candidates: Candidate[], target: Target): Decision {
  const pool = target ? candidates.filter((c) => c.title !== target.current_title) : candidates;
  const best = [...pool].sort((a, b) => b.coverage - a.coverage || a.total_minutes - b.total_minutes)[0];
  if (!best) {
    return { reply: 'No encontré recetas que cumplan tus restricciones para este momento. Prueba agregando ingredientes a tu cocina.', recipeId: null, fallback: true };
  }
  const missing = missingNames(best);
  return {
    reply: `Te propongo "${best.title}" (${best.total_minutes} min)` + (missing.length ? `; te falta ${missing.join(', ')}.` : ', y tienes todo lo necesario.'),
    recipeId: best.recipe_id,
    fallback: true,
  };
}

/** Momento del día en Colombia (UTC−5, sin horario de verano), igual que momentOfDay en la app. */
export function slotForNow(now = new Date()): string {
  const hour = (now.getUTCHours() + 24 - 5) % 24;
  return hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 18 ? 'snack' : 'dinner';
}
