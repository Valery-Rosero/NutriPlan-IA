// Adaptador del LLM (ADR-025). Cambiar de proveedor solo toca este archivo.
// Gemini con salida estructurada: el modelo devuelve JSON con el esquema de abajo, no texto libre.

export type LlmTurn = { role: 'user' | 'assistant'; text: string };
export type LlmAnswer = { raw: unknown; inputTokens: number | null; outputTokens: number | null; model: string };

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING', description: 'Respuesta corta, en español de Colombia, máximo 3 frases.' },
    recipe_id: { type: 'STRING', nullable: true, description: 'id EXACTO de una receta de la lista de candidatas, o null.' },
    pantry_only: { type: 'BOOLEAN', description: 'true si la persona pidió usar SOLO lo que tiene en la cocina.' },
  },
  required: ['reply', 'pantry_only'],
};

export async function askGemini(system: string, turns: LlmTurn[], timeoutMs = 8000): Promise<LlmAnswer> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('llm_not_configured');
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: turns.map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.text }] })),
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 400,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });
    if (!res.ok) throw new Error(`llm_http_${res.status}`);
    const body = await res.json();
    const text: string | undefined = body?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('llm_empty');
    return {
      raw: JSON.parse(text),
      inputTokens: body?.usageMetadata?.promptTokenCount ?? null,
      outputTokens: body?.usageMetadata?.candidatesTokenCount ?? null,
      model,
    };
  } finally {
    clearTimeout(timer);
  }
}
