// Edge Function categorize-food (B3, ADR-027): clasifica un texto libre ("queso campesino", "bolsas",
// "empanada") en grupo de alimento, sección del supermercado, momento del día y nutrición aproximada.
// Orden: caché (food_labels) → catálogo (ingredientes) → Gemini (listas cerradas, validado) → reglas.
// Nunca falla por la IA: si no está, se demora o se acabó la cuota, responde con las reglas.
// Sin datos de salud: solo recibe el texto del alimento.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { askGeminiJson } from '../_shared/gemini.ts';
import { reportEdgeError } from '../_shared/report-error.ts';
import {
  displayName,
  MAX_TEXT,
  normalizeFoodText,
  responseSchema,
  rulesLabel,
  systemPrompt,
  validateLabel,
  type Code,
  type Label,
} from './logic.ts';

type Source = 'cache' | 'catalog' | 'ai' | 'rules';

const DAILY_AI_QUOTA = 100; // lo que ya está en caché o en el catálogo no cuenta
const AI_TIMEOUT_MS = 5000;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const fail = (status: number, code: string) => json(status, { ok: false, error: { code } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed');
  const auth = req.headers.get('Authorization') ?? '';
  if (!/^Bearer\s+\S+/i.test(auth)) return fail(401, 'not_authenticated');

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text : '';
  const key = normalizeFoodText(text);
  if (key.length < 2 || text.length > MAX_TEXT * 2) return fail(400, 'invalid_input');

  const url = Deno.env.get('SUPABASE_URL')!;
  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: who, error: whoError } = await user.auth.getUser();
  if (whoError || !who.user) return fail(401, 'not_authenticated');
  // Como backend: solo para escribir la caché y el registro de uso de IA (la app no puede).
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const [groupsRes, categoriesRes] = await Promise.all([
      admin.from('food_groups').select('id, code, name').order('id'),
      admin.from('ingredient_categories').select('id, code, name').order('sort_order'),
    ]);
    if (groupsRes.error || categoriesRes.error) throw groupsRes.error ?? categoriesRes.error;
    const groups = groupsRes.data as (Code & { id: number })[];
    const categories = categoriesRes.data as (Code & { id: number })[];
    const groupId = new Map(groups.map((g) => [g.code, g.id]));
    const groupCode = new Map(groups.map((g) => [g.id, g.code]));
    const categoryId = new Map(categories.map((c) => [c.code, c.id]));
    const categoryCode = new Map(categories.map((c) => [c.id, c.code]));

    const respond = (label: Label, source: Source) =>
      json(200, {
        ok: true,
        data: {
          key,
          name: displayName(text),
          is_food: label.isFood,
          food_group_id: label.foodGroup ? groupId.get(label.foodGroup) ?? null : null,
          food_group: label.foodGroup,
          store_category_id: categoryId.get(label.storeCategory) ?? categoryId.get('other') ?? null,
          store_category: label.storeCategory,
          meal_slot: label.mealSlot,
          kcal_per_serving: label.kcalPerServing,
          protein_g_per_serving: label.proteinPerServing,
          source,
        },
      });

    // 1. Caché compartida
    const { data: cached } = await admin.from('food_labels').select('*').eq('key', key).maybeSingle();
    if (cached) {
      return respond(
        {
          isFood: cached.is_food,
          foodGroup: cached.food_group_id ? groupCode.get(cached.food_group_id) ?? null : null,
          storeCategory: categoryCode.get(cached.store_category_id) ?? 'other',
          mealSlot: cached.meal_slot,
          kcalPerServing: cached.kcal_per_serving === null ? null : Number(cached.kcal_per_serving),
          proteinPerServing: cached.protein_g_per_serving === null ? null : Number(cached.protein_g_per_serving),
        },
        'cache',
      );
    }

    // 2. Catálogo: si el texto es un ingrediente que ya conocemos, manda el catálogo (revisado), no la IA.
    const { data: ingredients } = await admin.from('ingredients').select('name, food_group_id, store_category_id');
    const known = (ingredients ?? []).find((i) => normalizeFoodText(i.name) === key);
    if (known) {
      return respond(
        {
          isFood: true,
          foodGroup: groupCode.get(known.food_group_id) ?? 'other',
          storeCategory: categoryCode.get(known.store_category_id) ?? 'other',
          mealSlot: null,
          kcalPerServing: null,
          proteinPerServing: null,
        },
        'catalog',
      );
    }

    // 3. IA, con cuota diaria por persona
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { count } = await admin
      .from('ai_generations').select('id', { count: 'exact', head: true })
      .eq('user_id', who.user.id).eq('kind', 'label').gte('created_at', since);
    if ((count ?? 0) < DAILY_AI_QUOTA) {
      const started = Date.now();
      try {
        const answer = await askGeminiJson({
          system: systemPrompt(groups, categories),
          turns: [{ role: 'user', text: displayName(text) }],
          schema: responseSchema(groups, categories),
          temperature: 0.1,
          maxOutputTokens: 150,
          timeoutMs: AI_TIMEOUT_MS,
          caller: 'categorize-food',
        });
        await admin.from('ai_generations').insert({
          user_id: who.user.id, kind: 'label', model: answer.model, input_tokens: answer.inputTokens,
          output_tokens: answer.outputTokens, latency_ms: Date.now() - started,
        });
        const label = validateLabel(answer.raw, groups.map((g) => g.code), categories.map((c) => c.code));
        if (label) {
          // Si dos personas clasifican lo mismo a la vez, la primera gana (ignoreDuplicates).
          await admin.from('food_labels').upsert(
            {
              key,
              name: displayName(text),
              is_food: label.isFood,
              food_group_id: label.foodGroup ? groupId.get(label.foodGroup) ?? null : null,
              store_category_id: categoryId.get(label.storeCategory)!,
              meal_slot: label.mealSlot,
              kcal_per_serving: label.kcalPerServing,
              protein_g_per_serving: label.proteinPerServing,
              model: answer.model,
            },
            { onConflict: 'key', ignoreDuplicates: true },
          );
          return respond(label, 'ai');
        }
      } catch (e) {
        // La IA no está, se demoró o respondió algo inválido: se sigue con las reglas.
        console.warn('categorize-food: sin IA, se usan reglas', e instanceof Error ? e.message : 'error');
      }
    }

    // 4. Reglas (no se guardan en la caché: la próxima vez la IA puede hacerlo mejor)
    return respond(rulesLabel(key), 'rules');
  } catch (e) {
    await reportEdgeError(admin, 'categorize-food', e);
    // Ni siquiera por un fallo de la base se deja a la persona sin respuesta.
    return json(200, {
      ok: true,
      data: {
        key, name: displayName(text), ...toWire(rulesLabel(key)), food_group_id: null, store_category_id: null, source: 'rules',
      },
    });
  }
});

function toWire(label: Label) {
  return {
    is_food: label.isFood,
    food_group: label.foodGroup,
    store_category: label.storeCategory,
    meal_slot: label.mealSlot,
    kcal_per_serving: label.kcalPerServing,
    protein_g_per_serving: label.proteinPerServing,
  };
}
