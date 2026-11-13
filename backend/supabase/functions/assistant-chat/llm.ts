// Adaptador del LLM del asistente (ADR-025). La llamada a Gemini vive en _shared/gemini.ts; aquí solo
// el esquema de respuesta del asistente y sus parámetros.
import { askGeminiJson, DEFAULT_MODEL, type LlmAnswer, type LlmTurn } from '../_shared/gemini.ts';

export { DEFAULT_MODEL };
export type { LlmAnswer, LlmTurn };

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING', description: 'Respuesta corta, en español de Colombia, máximo 3 frases.' },
    recipe_id: { type: 'STRING', nullable: true, description: 'id EXACTO de una receta de la lista de candidatas, o null.' },
    pantry_only: { type: 'BOOLEAN', description: 'true si la persona pidió usar SOLO lo que tiene en la cocina.' },
  },
  required: ['reply', 'pantry_only'],
};

export function askGemini(system: string, turns: LlmTurn[], timeoutMs = 8000): Promise<LlmAnswer> {
  return askGeminiJson({
    system,
    turns,
    schema: RESPONSE_SCHEMA,
    temperature: 0.4,
    maxOutputTokens: 400,
    timeoutMs,
    caller: 'assistant-chat',
  });
}
