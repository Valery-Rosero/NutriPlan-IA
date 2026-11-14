// Adaptador del LLM del asistente (ADR-025, ADR-029, ADR-037). La llamada a Gemini vive en _shared/gemini.ts;
// aquí solo los esquemas de respuesta de los dos pasos (lista de platos y receta) y sus parámetros.
import { askGeminiJson, DEFAULT_MODEL, type LlmAnswer, type LlmTurn } from '../_shared/gemini.ts';

export { DEFAULT_MODEL };
export type { LlmAnswer, LlmTurn };

/** Paso 1: una frase + 4–5 platos (o el modo semana). */
const IDEAS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING', description: 'UNA frase corta y cálida que presente la lista (sin repetir los platos).' },
    ideas: {
      type: 'ARRAY',
      description: 'De 4 a 5 platos distintos entre sí (vacío solo si no corresponde proponer comida).',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'Nombre corto y antojador.' },
          blurb: { type: 'STRING', description: 'Una frase de máximo 90 caracteres.' },
          minutes: { type: 'INTEGER', description: 'Minutos totales realistas.' },
        },
        required: ['title', 'blurb', 'minutes'],
      },
    },
    week: {
      type: 'OBJECT',
      nullable: true,
      description: 'Solo si pide cambiar VARIAS comidas o la semana (US-174); si no, null.',
      properties: {
        goal: { type: 'STRING', nullable: true, enum: ['cheaper', 'faster', 'protein', 'variety', 'use_expiring'] },
        avoid: { type: 'ARRAY', items: { type: 'STRING', description: 'Referencia exacta I… de lo que no quiere.' } },
      },
    },
  },
  required: ['reply', 'ideas'],
};

/** Paso 2: la plantilla de la receta del plato elegido. */
const RECIPE_SCHEMA = {
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

export function askIdeas(system: string, turns: LlmTurn[], timeoutMs = 15000): Promise<LlmAnswer> {
  return askGeminiJson({ system, turns, schema: IDEAS_SCHEMA, temperature: 0.8, maxOutputTokens: 1200, timeoutMs, caller: 'assistant-chat' });
}

export function askRecipe(system: string, timeoutMs = 20000): Promise<LlmAnswer> {
  return askGeminiJson({
    system,
    turns: [{ role: 'user', text: 'Arma la receta.' }],
    schema: RECIPE_SCHEMA,
    temperature: 0.5,
    maxOutputTokens: 2000,
    timeoutMs,
    caller: 'assistant-chat',
  });
}
