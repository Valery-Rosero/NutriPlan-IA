// Llamadas a Gemini de plan-ai (ADR-039): el menú y las recetas (hasta 4 por llamada).
import { askGeminiJson, type LlmAnswer } from '../_shared/gemini.ts';
import { RECIPE_RESPONSE_SCHEMA } from '../_shared/recipe-ai.ts';

const MENU_SCHEMA = {
  type: 'OBJECT',
  properties: {
    dishes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'Nombre corto y antojador.' },
          blurb: { type: 'STRING', description: 'Una frase de máximo 90 caracteres.' },
          kind: { type: 'STRING', enum: ['breakfast', 'main'] },
          minutes: { type: 'INTEGER' },
          uses_expiring: { type: 'BOOLEAN' },
        },
        required: ['title', 'blurb', 'kind', 'minutes', 'uses_expiring'],
      },
    },
  },
  required: ['dishes'],
};

const RECIPES_SCHEMA = {
  type: 'OBJECT',
  properties: { recipes: { type: 'ARRAY', description: 'Una receta por plato, en el mismo orden.', items: RECIPE_RESPONSE_SCHEMA } },
  required: ['recipes'],
};

export function askMenu(system: string): Promise<LlmAnswer> {
  return askGeminiJson({
    system,
    turns: [{ role: 'user', text: 'Arma el menú.' }],
    schema: MENU_SCHEMA,
    temperature: 0.9,
    maxOutputTokens: 2500,
    timeoutMs: 40000,
    caller: 'plan-ai',
  });
}

export function askRecipes(system: string): Promise<LlmAnswer> {
  return askGeminiJson({
    system,
    turns: [{ role: 'user', text: 'Escribe las recetas.' }],
    schema: RECIPES_SCHEMA,
    temperature: 0.5,
    maxOutputTokens: 6000,
    timeoutMs: 60000,
    caller: 'plan-ai',
  });
}
