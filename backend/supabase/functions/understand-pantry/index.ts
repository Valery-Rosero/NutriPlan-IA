// Edge Function understand-pantry (ADR-030): "Escríbelo como lo dirías". Convierte un texto libre en varias cosas
// para la cocina, relacionadas con el catálogo, con cantidad, unidad y vencimiento sugeridos. Solo PROPONE: la
// persona revisa la lista y la app guarda con add_to_pantry (que valida) o como alimento propio.
// Orden: Gemini (lista cerrada del catálogo, validado) → reglas. Nunca falla por la IA.
// ADR-032: también recibe una FOTO (nevera o recibo). La foto se procesa en memoria y NO se guarda en ningún
// lado ni se registra; sin IA no hay reglas para una foto, así que responde ai_unavailable.
// Sin datos de salud: solo recibe el texto o la foto y los nombres del catálogo.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { askGeminiJson } from '../_shared/gemini.ts';
import { reportEdgeError } from '../_shared/report-error.ts';
import {
  IMAGE_MIME,
  MASS,
  MAX_IMAGE_BASE64,
  MAX_TEXT,
  PHOTO_KINDS,
  PHOTO_SCHEMA,
  photoPrompt,
  RESPONSE_SCHEMA,
  rulesParse,
  systemPrompt,
  validateItems,
  validatePhoto,
  type CatalogIngredient,
  type PhotoKind,
} from './logic.ts';

const DAILY_AI_QUOTA = 40;
const AI_TIMEOUT_MS = 8000;
const PHOTO_TIMEOUT_MS = 20000; // una foto tarda más en analizarse que un texto

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const fail = (status: number, code: string) => json(status, { ok: false, error: { code } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed');
  const auth = req.headers.get('Authorization') ?? '';
  if (!/^Bearer\s+\S+/i.test(auth)) return fail(401, 'not_authenticated');

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  // Foto: { image: { data (base64), mime_type }, kind: 'fridge' | 'receipt' }
  const image = body?.image && typeof body.image.data === 'string' ? body.image : null;
  const kind: PhotoKind | null = (PHOTO_KINDS as readonly string[]).includes(body?.kind) ? body.kind : null;
  if (image) {
    if (!kind || !(IMAGE_MIME as readonly string[]).includes(image.mime_type) || image.data.length < 100 || image.data.length > MAX_IMAGE_BASE64) {
      return fail(400, 'invalid_input');
    }
  } else if (text.length < 2 || text.length > MAX_TEXT) {
    return fail(400, 'invalid_input');
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: who, error: whoError } = await user.auth.getUser();
  if (whoError || !who.user) return fail(401, 'not_authenticated');
  // Como backend: solo para el registro de uso de IA (la app no puede escribirlo).
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // Catálogo con sus unidades contables (las de masa siempre sirven; volumen no, igual que la app).
    const [ingRes, weightRes] = await Promise.all([
      admin.from('ingredients').select('id, name, shelf_life_days').order('name'),
      admin.from('ingredient_unit_weights').select('ingredient_id, units!inner(code)'),
    ]);
    if (ingRes.error || weightRes.error) throw ingRes.error ?? weightRes.error;
    const countUnits = new Map<string, string[]>();
    for (const w of weightRes.data as { ingredient_id: string; units: { code: string } }[]) {
      countUnits.set(w.ingredient_id, [...(countUnits.get(w.ingredient_id) ?? []), w.units.code]);
    }
    const catalog: CatalogIngredient[] = ingRes.data.map((i) => ({
      id: i.id,
      name: i.name,
      shelf_life_days: i.shelf_life_days,
      units: [...(countUnits.get(i.id) ?? []), ...MASS],
    }));

    const respond = (items: ReturnType<typeof rulesParse>, source: 'ai' | 'rules') => json(200, { ok: true, data: { items, source } });

    // IA, con cuota diaria por persona
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { count } = await admin
      .from('ai_generations').select('id', { count: 'exact', head: true })
      .eq('user_id', who.user.id).eq('kind', 'pantry').gte('created_at', since);
    // ADR-032: foto. Sin IA (o sin cuota) no hay cómo leerla: la app ofrece escribirlo o buscarlo.
    if (image && kind) {
      if ((count ?? 0) >= DAILY_AI_QUOTA) return fail(429, 'quota_exceeded');
      const started = Date.now();
      try {
        const answer = await askGeminiJson({
          system: photoPrompt(catalog, kind),
          turns: [{ role: 'user', text: kind === 'fridge' ? 'Esta es mi nevera.' : 'Este es mi recibo.', images: [{ mimeType: image.mime_type, data: image.data }] }],
          schema: PHOTO_SCHEMA,
          temperature: 0.1,
          maxOutputTokens: 1200,
          timeoutMs: PHOTO_TIMEOUT_MS,
          caller: 'understand-pantry',
        });
        await admin.from('ai_generations').insert({
          user_id: who.user.id, kind: 'pantry', model: answer.model,
          input_tokens: answer.inputTokens, output_tokens: answer.outputTokens, latency_ms: Date.now() - started,
        });
        const result = validatePhoto(answer.raw, catalog, kind);
        if (result) return json(200, { ok: true, data: { ...result, source: 'ai' } });
      } catch (e) {
        console.warn('understand-pantry: foto sin ia', (e as Error).message); // nunca la imagen ni su contenido
      }
      return fail(503, 'ai_unavailable');
    }

    if ((count ?? 0) < DAILY_AI_QUOTA) {
      const started = Date.now();
      try {
        const answer = await askGeminiJson({
          system: systemPrompt(catalog),
          turns: [{ role: 'user', text }],
          schema: RESPONSE_SCHEMA,
          temperature: 0.1,
          maxOutputTokens: 800,
          timeoutMs: AI_TIMEOUT_MS,
          caller: 'understand-pantry',
        });
        await admin.from('ai_generations').insert({
          user_id: who.user.id, kind: 'pantry', model: answer.model,
          input_tokens: answer.inputTokens, output_tokens: answer.outputTokens, latency_ms: Date.now() - started,
        });
        const items = validateItems(answer.raw, catalog);
        if (items) return respond(items, 'ai');
      } catch (e) {
        console.warn('understand-pantry: ia no disponible', (e as Error).message); // sin el texto de la persona
      }
    }

    // Reglas: siempre responde algo útil
    return respond(rulesParse(text, catalog), 'rules');
  } catch (e) {
    console.error('understand-pantry: error', (e as { code?: string }).code ?? 'unknown');
    await reportEdgeError(admin, 'understand-pantry', e);
    return fail(500, 'unknown');
  }
});
