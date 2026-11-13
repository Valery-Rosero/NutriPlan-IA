// Adaptador de Gemini compartido por las Edge Functions (ADR-025). Cambiar de proveedor solo toca este archivo.
// Salida estructurada: el modelo devuelve JSON con el esquema que se le pasa, no texto libre.

/** Imagen que acompaña un turno (foto de la nevera o de un recibo, ADR-032). Base64 sin prefijo `data:`. */
export type LlmImage = { mimeType: string; data: string };
export type LlmTurn = { role: 'user' | 'assistant'; text: string; images?: LlmImage[] };
export type LlmAnswer = { raw: unknown; inputTokens: number | null; outputTokens: number | null; model: string };

/**
 * Alias oficial que apunta siempre al Flash-Lite estable más reciente. Alias y no versión fija: Google
 * retira versiones (la familia 2.5 ya no se ofrece a cuentas nuevas). Flash-Lite: responde en ~2 s y en
 * pruebas (nov. 2026) el Flash completo no respondía en la capa gratuita.
 */
export const DEFAULT_MODEL = 'gemini-flash-lite-latest';

/** Errores pasajeros de Google (saturación, límite por minuto): vale la pena un segundo intento. */
const TRANSIENT = new Set([429, 500, 503]);

class ModelNotFound extends Error {}
class Transient extends Error {}

export type GeminiRequest = {
  system: string;
  turns: LlmTurn[];
  /** Esquema de respuesta (formato OpenAPI de Gemini). */
  schema: Record<string, unknown>;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
  /** Para el aviso en los registros si el modelo configurado ya no existe. */
  caller: string;
};

export async function askGeminiJson(req: GeminiRequest): Promise<LlmAnswer> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('llm_not_configured');
  const configured = Deno.env.get('GEMINI_MODEL')?.trim() || DEFAULT_MODEL;
  const deadline = Date.now() + req.timeoutMs;
  try {
    try {
      return await call(key, configured, req, deadline - Date.now());
    } catch (e) {
      // Un reintento ante errores pasajeros, solo si queda al menos la mitad del tiempo.
      if (e instanceof Transient && deadline - Date.now() > req.timeoutMs / 2) {
        return await call(key, configured, req, deadline - Date.now());
      }
      throw e;
    }
  } catch (e) {
    // Si el modelo fijado en GEMINI_MODEL ya no existe, se sigue con el alias en vez de quedar sin IA.
    if (e instanceof ModelNotFound && configured !== DEFAULT_MODEL) {
      console.warn(`${req.caller}: el modelo ${configured} no existe; usando ${DEFAULT_MODEL}`);
      return await call(key, DEFAULT_MODEL, req, req.timeoutMs);
    }
    throw e;
  }
}

async function call(key: string, model: string, req: GeminiRequest, timeoutMs: number): Promise<LlmAnswer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: req.turns.map((t) => ({
          role: t.role === 'assistant' ? 'model' : 'user',
          parts: [...(t.images ?? []).map((i) => ({ inlineData: { mimeType: i.mimeType, data: i.data } })), { text: t.text }],
        })),
        generationConfig: {
          temperature: req.temperature,
          maxOutputTokens: req.maxOutputTokens,
          responseMimeType: 'application/json',
          responseSchema: req.schema,
        },
      }),
    });
    if (res.status === 404) throw new ModelNotFound(model);
    if (TRANSIENT.has(res.status)) throw new Transient(`llm_http_${res.status}`);
    if (!res.ok) throw new Error(`llm_http_${res.status}`);
    const body = await res.json();
    const text: string | undefined = body?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('llm_empty');
    return {
      raw: JSON.parse(text),
      inputTokens: body?.usageMetadata?.promptTokenCount ?? null,
      outputTokens: body?.usageMetadata?.candidatesTokenCount ?? null,
      model: body?.modelVersion ?? model, // el alias se resuelve: se registra la versión real usada
    };
  } finally {
    clearTimeout(timer);
  }
}
