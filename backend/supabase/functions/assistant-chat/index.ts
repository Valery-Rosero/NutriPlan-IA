// Edge Function assistant-chat (US-157, US-160; contrato en docs/02-arquitectura/edge-functions.md §2, ADR-025, ADR-029).
// El LLM propone, la BD dispone: las recetas del recetario y los ingredientes permitidos salen de la base con el
// JWT de la persona (ya filtrados por alergias, dietas y tiempo). El modelo propone hasta tres opciones, del
// recetario o inventadas; se validan aquí, cada receta nueva pasa por create_assistant_recipe (que vuelve a
// validar todo) y una opción se aplica con apply_assistant_suggestion.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { reportEdgeError } from '../_shared/report-error.ts';
import { askGemini, type LlmTurn } from './llm.ts';
import {
  fallbackDecision,
  newRecipeSummary,
  requestSchema,
  slotForNow,
  systemPrompt,
  validateAnswer,
  type Candidate,
  type Context,
  type Decision,
  type SafeIngredient,
  type Target,
  type WeekRow,
  weekSummary,
} from './logic.ts';

type ErrorCode = 'method_not_allowed' | 'not_authenticated' | 'invalid_input' | 'quota_exceeded' | 'meal_not_found' | 'unknown';

type Suggestion = {
  recipe_id: string;
  title: string;
  total_minutes: number;
  coverage: number;
  missing: string[];
  by_assistant: boolean;
};

const DAILY_QUOTA = 30;
const HISTORY = 10;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const fail = (status: number, code: ErrorCode) => json(status, { ok: false, error: { code } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed');
  const auth = req.headers.get('Authorization') ?? '';
  if (!/^Bearer\s+\S+/i.test(auth)) return fail(401, 'not_authenticated');

  const input = requestSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) return fail(400, 'invalid_input');
  const { message, planned_meal_id } = input.data;

  const url = Deno.env.get('SUPABASE_URL')!;
  // Como la persona (RLS): todo lo que lee, crea y elige pasa por sus permisos y restricciones.
  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Como backend: solo para escribir lo que la persona no puede (respuestas del asistente y uso de IA).
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: who, error: whoError } = await user.auth.getUser();
  if (whoError || !who.user) return fail(401, 'not_authenticated');
  const userId = who.user.id;

  /**
   * Convierte las opciones validadas en recetas reales: las del recetario tal cual; las nuevas se guardan con
   * create_assistant_recipe COMO LA PERSONA (la base vuelve a validar alergias, dietas, tiempo y cantidades).
   * Si la base rechaza una receta nueva, esa opción simplemente no se muestra.
   */
  async function materialize(decision: Decision, ctx: Context): Promise<Suggestion[]> {
    const out: Suggestion[] = [];
    for (const pick of decision.picks) {
      if (pick.kind === 'catalog') {
        const c = ctx.candidates.find((x) => x.recipe_id === pick.recipeId);
        if (!c) continue;
        out.push({
          recipe_id: c.recipe_id,
          title: c.title,
          total_minutes: c.total_minutes,
          coverage: c.coverage,
          missing: (c.missing ?? []).map((m) => m.ingredient_name ?? m.name ?? '').filter(Boolean),
          by_assistant: false,
        });
        continue;
      }
      const { data: id, error } = await user.rpc('create_assistant_recipe', { p_recipe: pick.recipe });
      if (error || !id) {
        console.warn('assistant-chat: receta nueva rechazada por la base', error?.message?.split(':')[0] ?? 'sin id');
        continue;
      }
      const summary = newRecipeSummary(pick.recipe, ctx.ingredients);
      out.push({
        recipe_id: id as string,
        title: pick.recipe.title,
        total_minutes: summary.totalMinutes,
        coverage: summary.coverage,
        missing: summary.missing,
        by_assistant: true,
      });
    }
    return out;
  }

  try {
    // Cuota diaria (ADR-025)
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { count } = await admin
      .from('ai_generations').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).gte('created_at', since);
    if ((count ?? 0) >= DAILY_QUOTA) return fail(429, 'quota_exceeded');

    // Comida destino (si viene): debe ser de la persona y seguir pendiente.
    let target: Target = null;
    let currentRecipeId: string | null = null;
    if (planned_meal_id) {
      const { data: meal } = await user
        .from('planned_meals').select('id, slot, status, recipe_id, recipes!recipe_id(title)') // dos FK a recipes: se indica cuál
        .eq('id', planned_meal_id).maybeSingle();
      if (!meal || meal.status !== 'planned') return fail(404, 'meal_not_found');
      target = { planned_meal_id: meal.id, slot: meal.slot, current_title: (meal.recipes as { title: string } | null)?.title ?? '' };
      currentRecipeId = meal.recipe_id;
    }
    const slot = target?.slot ?? slotForNow();

    // Conversación (propia, por RLS) y mensaje de la persona.
    let conversationId = input.data.conversation_id;
    if (conversationId) {
      const { data: conv } = await user.from('assistant_conversations').select('id').eq('id', conversationId).maybeSingle();
      if (!conv) conversationId = undefined;
    }
    if (!conversationId) {
      const { data: conv, error } = await user.from('assistant_conversations').insert({ user_id: userId }).select('id').single();
      if (error) throw error;
      conversationId = conv.id;
    }
    const { data: history } = await user
      .from('assistant_messages').select('role, content')
      .eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(HISTORY);
    const { error: userMsgError } = await user
      .from('assistant_messages').insert({ conversation_id: conversationId, role: 'user', content: message });
    if (userMsgError) throw userMsgError;

    // Recetario seguro para la persona (eligible_recipes adentro), ingredientes que puede comer y su plan vigente
    // (el mismo criterio que la app: el primero no archivado que no ha terminado y tiene comidas planeadas).
    const today = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10); // Colombia, UTC−5
    const [{ data: rows, error: candError }, { data: safe, error: ingError }, { data: me }, { data: plans }] = await Promise.all([
      user.rpc('cook_with_what_i_have', { p_slot: slot, p_limit: 12 }),
      user.rpc('assistant_ingredients'),
      user.from('profiles').select('household_size').eq('id', userId).maybeSingle(),
      user.from('meal_plans').select('id, planned_meals(is_extra)').neq('status', 'archived').gte('end_date', today)
        .order('start_date').limit(5),
    ]);
    if (candError) throw candError;
    if (ingError) throw ingError;
    // Al cambiar una comida, la receta actual no es opción: "cámbiala" nunca devuelve la misma.
    const candidates = ((rows ?? []) as Candidate[]).filter((c) => c.recipe_id !== currentRecipeId);
    const ingredients = (safe ?? []) as SafeIngredient[];
    const planId = (plans ?? []).find((p) => (p.planned_meals as { is_extra: boolean }[]).some((m) => !m.is_extra))?.id ?? null;
    const ctx: Context = { slot, candidates, ingredients, target, servings: me?.household_size ?? 2, hasPlan: !!planId };

    // El modelo propone; si falla o nada de lo que propone sirve, respaldo determinista.
    const turns: LlmTurn[] = [
      ...(history ?? []).reverse().map((m) => ({ role: m.role as 'user' | 'assistant', text: m.content })),
      { role: 'user', text: message },
    ];
    const started = Date.now();
    let decision: Decision | null = null;
    let usage: { model: string; inputTokens: number | null; outputTokens: number | null } | null = null;
    try {
      const answer = await askGemini(systemPrompt(ctx), turns);
      usage = answer;
      decision = validateAnswer(answer.raw, ctx);
    } catch (e) {
      console.warn('assistant-chat: llm no disponible', (e as Error).message); // sin contenido de la persona
    }

    // US-174: cambio a la semana. La base calcula; aquí solo se resume con sus cifras.
    let week: Record<string, unknown> | null = null;
    if (decision?.week && planId) {
      const { data: proposal, error: weekError } = await user.rpc('propose_week_changes', {
        p_plan_id: planId,
        p_goal: decision.week.goal,
        p_avoid: decision.week.avoid.map((a) => a.id),
        p_limit: 93,
      });
      if (weekError) throw weekError;
      const summary = weekSummary((proposal ?? []) as WeekRow[]);
      decision = { ...decision, reply: `${decision.reply}\n\n${summary.text}` };
      week = {
        goal: decision.week!.goal,
        avoid: decision.week!.avoid,
        changes: summary.changes,
        saving: summary.saving,
        unresolved: summary.unresolved,
      };
    }

    let suggestions = decision ? await materialize(decision, ctx) : [];
    // Propuso opciones pero la base no aceptó ninguna: no se muestra un texto que hable de platos inexistentes.
    if (!decision || (!week && decision.picks.length > 0 && suggestions.length === 0)) {
      decision = fallbackDecision(candidates, target);
      suggestions = await materialize(decision, ctx);
    }

    const first = suggestions[0] ?? null;
    const { data: saved, error: saveError } = await admin
      .from('assistant_messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: decision.reply,
        suggested_recipe_id: first?.recipe_id ?? null,
        target_planned_meal_id: first && target ? target.planned_meal_id : null,
      })
      .select('id')
      .single();
    if (saveError) throw saveError;
    if (suggestions.length > 0) {
      const { error: sugError } = await admin
        .from('assistant_message_suggestions')
        .insert(suggestions.map((s, i) => ({ message_id: saved.id, position: i + 1, recipe_id: s.recipe_id })));
      if (sugError) throw sugError;
    }

    await admin.from('ai_generations').insert({
      user_id: userId,
      kind: target ? 'swap' : 'chat',
      model: usage?.model ?? 'fallback',
      input_tokens: usage?.inputTokens ?? null,
      output_tokens: usage?.outputTokens ?? null,
      latency_ms: Date.now() - started,
    });

    return json(200, {
      ok: true,
      data: {
        conversation_id: conversationId,
        message_id: saved.id,
        reply: decision.reply,
        fallback: decision.fallback,
        target_planned_meal_id: first && target ? target.planned_meal_id : null,
        suggestions,
        // US-174: propuesta de cambios a la semana (la app la abre en "Revisa los cambios").
        week,
        has_plan: !!planId,
        // Compatibilidad con versiones anteriores de la app (una sola sugerencia).
        suggestion: first && {
          recipe_id: first.recipe_id,
          title: first.title,
          total_minutes: first.total_minutes,
          coverage: first.coverage,
          target_planned_meal_id: target?.planned_meal_id ?? null,
        },
      },
    });
  } catch (e) {
    console.error('assistant-chat: error', (e as { code?: string }).code ?? 'unknown');
    await reportEdgeError(admin, 'assistant-chat', e);
    return fail(500, 'unknown');
  }
});
