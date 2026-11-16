// Edge Function plan-ai (ADR-039): la semana o el mes con IA, en tres pasos que la app llama en orden (así
// muestra el avance real y ninguna llamada dura demasiado):
//   * "menu":    la IA propone los platos (nombre, frase, minutos) con lo que sabe de la persona.
//   * "recipes": la IA escribe hasta 4 recetas; cada una pasa por create_assistant_recipe (la base valida
//                alergias, dietas, tiempo y cantidades). La app manda varias a la vez.
//   * "save":    reparte las recetas en los días (nunca el mismo plato dos días seguidos), guarda el plan con
//                save_generated_plan (el trigger revisa cada comida), arma la lista de mercado y le agrega lo libre.
// Todo con el JWT de la persona (RLS). Sin IA, la app arma el plan con el recetario (generate_plan).
import { createClient } from 'npm:@supabase/supabase-js@2';

import { reportEdgeError } from '../_shared/report-error.ts';
import { DEFAULT_PROFILE, newRecipeSummary, type AssistantProfile, type SafeIngredient } from '../_shared/recipe-ai.ts';
import { askMenu, askRecipes } from './llm.ts';
import { menuCounts, menuIsEnough, menuPrompt, recipesPrompt, requestSchema, schedule, validateMenu, validateRecipes } from './logic.ts';

type ErrorCode =
  | 'method_not_allowed' | 'not_authenticated' | 'invalid_input' | 'quota_exceeded' | 'ai_unavailable' | 'not_enough_dishes'
  | 'plan_overlap_confirmed' | 'unknown';

/** Planes con IA por persona y día (aparte del chat). */
const DAILY_PLANS = 3;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const fail = (status: number, code: ErrorCode) => json(status, { ok: false, error: { code } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed');
  const auth = req.headers.get('Authorization') ?? '';
  if (!/^Bearer\s+\S+/i.test(auth)) return fail(401, 'not_authenticated');
  const input = requestSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) return fail(400, 'invalid_input');

  const url = Deno.env.get('SUPABASE_URL')!;
  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: who, error: whoError } = await user.auth.getUser();
  if (whoError || !who.user) return fail(401, 'not_authenticated');
  const userId = who.user.id;

  const logUsage = (kind: 'plan' | 'plan_recipes', usage: { model: string; inputTokens: number | null; outputTokens: number | null } | null, started: number) =>
    admin.from('ai_generations').insert({
      user_id: userId, kind, model: usage?.model ?? 'fallback',
      input_tokens: usage?.inputTokens ?? null, output_tokens: usage?.outputTokens ?? null, latency_ms: Date.now() - started,
    });

  /** Lo que la IA sabe de la persona y los ingredientes seguros (con su JWT: alergias y dietas ya fuera). */
  async function loadContext() {
    const [{ data: profile, error: pErr }, { data: safe, error: iErr }] = await Promise.all([
      user.rpc('assistant_profile'),
      user.rpc('assistant_ingredients'),
    ]);
    if (pErr) throw pErr;
    if (iErr) throw iErr;
    return {
      profile: { ...DEFAULT_PROFILE, ...((profile ?? {}) as Partial<AssistantProfile>) },
      ingredients: (safe ?? []) as SafeIngredient[],
    };
  }

  try {
    const data = input.data;

    // ---------- Paso 1: el menú ----------
    if (data.action === 'menu') {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { count } = await admin
        .from('ai_generations').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('kind', 'plan').gte('created_at', since);
      if ((count ?? 0) >= DAILY_PLANS) return fail(429, 'quota_exceeded');

      const ctx = await loadContext();
      const counts = menuCounts(data.days, data.slots);
      const started = Date.now();
      let answer;
      try {
        answer = await askMenu(menuPrompt(ctx, counts, data.days));
      } catch (e) {
        console.warn('plan-ai: llm no disponible', (e as Error).message);
        return fail(503, 'ai_unavailable');
      }
      await logUsage('plan', answer, started);
      const dishes = validateMenu(answer.raw, ctx, counts);
      if (!menuIsEnough(dishes, counts)) return fail(422, 'not_enough_dishes');
      return json(200, { ok: true, data: { dishes, counts } });
    }

    // ---------- Paso 2: las recetas (hasta 4) ----------
    if (data.action === 'recipes') {
      const ctx = await loadContext();
      const started = Date.now();
      let answer;
      try {
        answer = await askRecipes(recipesPrompt(ctx, data.dishes));
      } catch (e) {
        console.warn('plan-ai: llm no disponible', (e as Error).message);
        return fail(503, 'ai_unavailable');
      }
      await logUsage('plan_recipes', answer, started);
      const recipes = validateRecipes(answer.raw, ctx, data.dishes, data.slots);
      const out: { title: string; recipe_id: string | null; kind: string; expiring: boolean; coverage: number }[] = [];
      for (const [i, recipe] of recipes.entries()) {
        const dish = data.dishes[i];
        if (!recipe) {
          out.push({ title: dish.title, recipe_id: null, kind: dish.kind, expiring: false, coverage: 0 });
          continue;
        }
        const { data: id, error } = await user.rpc('create_assistant_recipe', { p_recipe: recipe });
        if (error || !id) console.warn('plan-ai: receta rechazada por la base', error?.message?.split(':')[0] ?? 'sin id');
        const summary = newRecipeSummary(recipe, ctx.ingredients);
        out.push({
          title: dish.title, recipe_id: (id as string | null) ?? null, kind: dish.kind,
          expiring: summary.usesExpiring, coverage: summary.coverage,
        });
      }
      return json(200, { ok: true, data: { recipes: out } });
    }

    // ---------- Paso 3: repartir, guardar y armar la lista ----------
    const ids = [...new Set(data.dishes.map((d) => d.recipe_id))];
    // Solo recetas del asistente de la persona (las demás se ignoran).
    const { data: own, error: ownError } = await user
      .from('recipes').select('id').in('id', ids).eq('author_id', userId).eq('created_by_assistant', true);
    if (ownError) throw ownError;
    const mine = new Set((own ?? []).map((r) => r.id as string));
    const dishes = data.dishes.filter((d) => mine.has(d.recipe_id));

    const end = new Date(Date.parse(`${data.start}T00:00:00Z`) + (data.days - 1) * 86_400_000).toISOString().slice(0, 10);
    const { data: cookedRows } = await user
      .from('planned_meals').select('meal_date, slot, meal_plans!inner(user_id)')
      .eq('status', 'cooked').eq('is_extra', false).gte('meal_date', data.start).lte('meal_date', end);
    const cooked = new Set((cookedRows ?? []).map((r) => `${r.meal_date}|${r.slot}`));

    const meals = schedule(data.start, data.days, data.slots, dishes, cooked);
    if (meals.length === 0) return fail(422, 'not_enough_dishes');
    const { data: planId, error: saveError } = await user.rpc('save_generated_plan', { p_start: data.start, p_end: end, p_meals: meals });
    if (saveError) {
      if ((saveError.message ?? '').startsWith('plan_overlap_confirmed')) return fail(409, 'plan_overlap_confirmed');
      throw saveError;
    }
    await user.from('meal_plans').update({ created_with_ai: true }).eq('id', planId);

    // Lista de mercado: lo del catálogo la arma la base; lo libre ("chontaduro") va por nombre, una vez.
    const { data: listId, error: listError } = await user.rpc('generate_shopping_list', { p_plan_id: planId });
    if (listError) throw listError;
    const { data: extras } = await user.from('recipe_extra_ingredients').select('name').in('recipe_id', [...new Set(meals.map((m) => m.recipe_id))]);
    const names = [...new Set((extras ?? []).map((e) => (e.name as string).trim()))];
    if (names.length) {
      const { data: already } = await user.from('shopping_list_items').select('custom_name').eq('list_id', listId).not('custom_name', 'is', null);
      const have = new Set((already ?? []).map((r) => (r.custom_name as string).toLowerCase()));
      const missing = names.filter((n) => !have.has(n.toLowerCase()));
      if (missing.length) await user.from('shopping_list_items').insert(missing.map((n) => ({ list_id: listId, custom_name: n, source: 'manual' })));
    }

    return json(200, { ok: true, data: { plan_id: planId, meals: meals.length, dishes: new Set(meals.map((m) => m.recipe_id)).size } });
  } catch (e) {
    console.error('plan-ai: error', (e as { code?: string }).code ?? 'unknown');
    await reportEdgeError(admin, 'plan-ai', e);
    return fail(500, 'unknown');
  }
});
