// Adaptador del LLM del asistente (ADR-025, ADR-029). La llamada a Gemini vive en _shared/gemini.ts; aquí solo
// el esquema de respuesta del asistente y sus parámetros.
import { askGeminiJson, DEFAULT_MODEL, type LlmAnswer, type LlmTurn } from '../_shared/gemini.ts';

export { DEFAULT_MODEL };
export type { LlmAnswer, LlmTurn };

const NEW_RECIPE = {
  type: 'OBJECT',
  nullable: true,
  description: 'Solo si kind = "new": una receta inventada con ingredientes de la lista I.',
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
        properties: { ref: { type: 'STRING', description: 'Referencia exacta I… de la lista.' }, grams: { type: 'NUMBER' } },
        required: ['ref', 'grams'],
      },
    },
    steps: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['title', 'servings', 'prep_minutes', 'cook_minutes', 'ingredients', 'steps'],
};

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING', description: 'Mensaje cálido en Markdown sencillo, máximo 120 palabras.' },
    pantry_only: { type: 'BOOLEAN', description: 'true si la persona pidió usar SOLO lo que tiene en la cocina.' },
    options: {
      type: 'ARRAY',
      description: 'De 1 a 3 opciones (vacío solo si no corresponde proponer comida).',
      items: {
        type: 'OBJECT',
        properties: {
          kind: { type: 'STRING', enum: ['catalog', 'new'] },
          ref: { type: 'STRING', nullable: true, description: 'Si kind = "catalog": referencia exacta R… del recetario.' },
          recipe: NEW_RECIPE,
        },
        required: ['kind'],
      },
    },
  },
  required: ['reply', 'pantry_only', 'options'],
};

/** Con recetas nuevas la respuesta es más larga: más tokens y algo más de tiempo que antes. */
export function askGemini(system: string, turns: LlmTurn[], timeoutMs = 15000): Promise<LlmAnswer> {
  return askGeminiJson({
    system,
    turns,
    schema: RESPONSE_SCHEMA,
    temperature: 0.6,
    maxOutputTokens: 2500,
    timeoutMs,
    caller: 'assistant-chat',
  });
}
