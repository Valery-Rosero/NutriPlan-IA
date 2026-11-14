// Edge Function assistant-chat (US-157, US-160, US-174; contrato en docs/02-arquitectura/edge-functions.md §2,
// ADR-025, ADR-029, ADR-037). "IA primero" en dos pasos:
//   * action "chat" (por defecto): la IA propone una lista de 4–5 platos con lo que sabe de la persona
//     (assistant_profile: preferencias + "no usar" sin el porqué). Las ideas quedan en el mensaje.
//   * action "fill": la persona elige una idea y la IA llena la plantilla; la receta pasa por
//     create_assistant_recipe (que vuelve a validar alergias, dietas, tiempo y cantidades) y queda como sugerencia
//     del mensaje (se puede aplicar a la comida destino con apply_assistant_suggestion).
// Sin IA, las ideas salen del recetario (respaldo) y elegir una devuelve esa receta tal cual.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { reportEdgeError } from '../_shared/report-error.ts';
import { askIdeas, askRecipe, type LlmTurn } from './llm.ts';
import {
  DEFAULT_PROFILE,
  fallbackDecision,
  fillPrompt,
  ideasPrompt,
  newRecipeSummary,
  requestSchema,
  slotForNow,
  validateFill,
  validateIdeas,
  type AssistantProfile,
  type Candidate,
  type Context,
  type Decision,
  type Idea,
  type SafeIngredient,
  type Target,
  type WeekRow,
  weekSummary,
} from './logic.ts';

type ErrorCode =
  | 'method_not_allowed' | 'not_authenticated' | 'invalid_input' | 'quota_exceeded' | 'meal_not_found'
  | 'message_not_found' | 'recipe_not_created' | 'unknown';

type Suggestion = {
  recipe_id: string;
  title: string;
  total_minutes: number;
  coverage: number;
  missing: string[];
  by_assistant: boolean;
};

/** Lo que se guarda en assistant_messages.ideas para el segundo paso. */
type StoredIdeas = { target: string | null; slot: string; items: Idea[] };

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

  /** Recetario seguro, ingredientes que puede comer y lo que la IA sabe de la persona (todo con su JWT). */
  async function loadContext(slot: string, target: Target, excludeRecipeId: string | null) {
    const today = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10); // Colombia, UTC−5
    const [{ data: rows, error: candError }, { data: safe, error: ingError }, { data: profile }, { data: plans }] = await Promise.all([
      user.rpc('cook_with_what_i_have', { p_slot: slot, p_limit: 12 }),
      user.rpc('assistant_ingredients'),
      user.rpc('assistant_profile'),
      user.from('meal_plans').select('id, planned_meals(is_extra)').neq('status', 'archived').gte('end_date', today)
        .order('start_date').limit(5),
    ]);
    if (candError) throw candError;
    if (ingError) throw ingError;
    const candidates = ((rows ?? []) as Candidate[]).filter((c) => c.recipe_id !== excludeRecipeId);
    const planId = (plans ?? []).find((p) => (p.planned_meals as { is_extra: boolean }[]).some((m) => !m.is_extra))?.id ?? null;
    const ctx: Context = {
      slot,
      candidates,
      ingredients: (safe ?? []) as SafeIngredient[],
      target,
      profile: { ...DEFAULT_PROFILE, ...((profile ?? {}) as Partial<AssistantProfile>) },
      hasPlan: !!planId,
    };
    return { ctx, planId };
  }

  async function overQuota() {
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { count } = await admin
      .from('ai_generations').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).gte('created_at', since);
    return (count ?? 0) >= DAILY_QUOTA;
  }

  async function logUsage(kind: 'chat' | 'swap', usage: { model: string; inputTokens: number | null; outputTokens: number | null } | null, started: number) {
    await admin.from('ai_generations').insert({
      user_id: userId,
      kind,
      model: usage?.model ?? 'fallback',
      input_tokens: usage?.inputTokens ?? null,
      output_tokens: usage?.outputTokens ?? null,
      latency_ms: Date.now() - started,
    });
  }

  try {
    if (await overQuota()) return fail(429, 'quota_exceeded');

    // ================= Paso 2: llenar la receta de la idea elegida =================
    if (input.data.action === 'fill') {
      const { message_id, idea: index } = input.data;
      const { data: msg } = await user
        .from('assistant_messages').select('id, role, ideas, suggested_recipe_id, conversation_id')
        .eq('id', message_id).eq('conversation_id', input.data.conversation_id).maybeSingle();
      const stored = msg?.ideas as StoredIdeas | null | undefined;
      const idea = stored?.items?.[index];
      if (!msg || msg.role !== 'assistant' || !stored || !idea) return fail(404, 'message_not_found');

      // La comida destino (si la había) debe seguir pendiente.
      let target: Target = null;
      let currentRecipeId: string | null = null;
      if (stored.target) {
        const { data: meal } = await user
          .from('planned_meals').select('id, slot, status, recipe_id, recipes!recipe_id(title)')
          .eq('id', stored.target).maybeSingle();
        if (!meal || meal.status !== 'planned') return fail(404, 'meal_not_found');
        target = { planned_meal_id: meal.id, slot: meal.slot, current_title: (meal.recipes as { title: string } | null)?.title ?? '' };
        currentRecipeId = meal.recipe_id;
      }
      const { ctx } = await loadContext(target?.slot ?? stored.slot, target, currentRecipeId);
      const started = Date.now();
      let suggestion: Suggestion | null = null;
      let usage: { model: string; inputTokens: number | null; outputTokens: number | null } | null = null;

      if (idea.recipe_id) {
        // Respaldo del recetario: la receta ya existe; solo se confirma que sigue siendo segura para la persona.
        const c = ctx.candidates.find((x) => x.recipe_id === idea.recipe_id);
        if (c) {
          suggestion = {
            recipe_id: c.recipe_id, title: c.title, total_minutes: c.total_minutes, coverage: c.coverage,
            missing: (c.missing ?? []).map((m) => m.ingredient_name ?? m.name ?? '').filter(Boolean), by_assistant: false,
          };
        }
      } else {
        // La IA llena la plantilla; la base la valida. Un segundo intento si la primera no sirve.
        for (let attempt = 0; attempt < 2 && !suggestion; attempt++) {
          try {
            const answer = await askRecipe(fillPrompt(ctx, idea));
            usage = answer;
            const recipe = validateFill(answer.raw, ctx, idea);
            if (!recipe) continue;
            const { data: id, error } = await user.rpc('create_assistant_recipe', { p_recipe: recipe });
            if (error || !id) {
              console.warn('assistant-chat: receta rechazada por la base', error?.message?.split(':')[0] ?? 'sin id');
              continue;
            }
            const summary = newRecipeSummary(recipe, ctx.ingredients);
            suggestion = {
              recipe_id: id as string, title: recipe.title, total_minutes: summary.totalMinutes,
              coverage: summary.coverage, missing: summary.missing, by_assistant: true,
            };
          } catch (e) {
            console.warn('assistant-chat: llm no disponible', (e as Error).message);
            break;
          }
        }
      }
      await logUsage(target ? 'swap' : 'chat', usage, started);
      if (!suggestion) return fail(422, 'recipe_not_created');

      // Queda como sugerencia del mensaje (en la posición de la idea), para poder aplicarla.
      await admin.from('assistant_message_suggestions').delete().eq('message_id', msg.id).eq('position', index + 1);
      await admin.from('assistant_message_suggestions').delete().eq('message_id', msg.id).eq('recipe_id', suggestion.recipe_id);
      const { error: sugError } = await admin
        .from('assistant_message_suggestions').insert({ message_id: msg.id, position: index + 1, recipe_id: suggestion.recipe_id });
      if (sugError) throw sugError;
      if (!msg.suggested_recipe_id) {
        const { error: updError } = await admin
          .from('assistant_messages')
          .update({ suggested_recipe_id: suggestion.recipe_id, target_planned_meal_id: target?.planned_meal_id ?? null })
          .eq('id', msg.id);
        if (updError) throw updError;
      }
      return json(200, { ok: true, data: { suggestion: { ...suggestion, target_planned_meal_id: target?.planned_meal_id ?? null } } });
    }

    // ================= Paso 1: la lista de platos =================
    const { message, planned_meal_id } = input.data;
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

    const { ctx, planId } = await loadContext(slot, target, currentRecipeId);

    const turns: LlmTurn[] = [
      ...(history ?? []).reverse().map((m) => ({ role: m.role as 'user' | 'assistant', text: m.content })),
      { role: 'user', text: message },
    ];
    const started = Date.now();
    let decision: Decision | null = null;
    let usage: { model: string; inputTokens: number | null; outputTokens: number | null } | null = null;
    try {
      const answer = await askIdeas(ideasPrompt(ctx), turns);
      usage = answer;
      decision = validateIdeas(answer.raw, ctx);
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
    if (!decision) decision = fallbackDecision(ctx.candidates, target);

    const stored: StoredIdeas = { target: target?.planned_meal_id ?? null, slot, items: decision.ideas };
    const { data: saved, error: saveError } = await admin
      .from('assistant_messages')
      .insert({ conversation_id: conversationId, role: 'assistant', content: decision.reply, ideas: decision.ideas.length ? stored : null })
      .select('id')
      .single();
    if (saveError) throw saveError;
    await logUsage(target ? 'swap' : 'chat', usage, started);

    return json(200, {
      ok: true,
      data: {
        conversation_id: conversationId,
        message_id: saved.id,
        reply: decision.reply,
        fallback: decision.fallback,
        target_planned_meal_id: target?.planned_meal_id ?? null,
        // ADR-037: la lista de platos; elegir uno llama a action "fill" con su posición.
        ideas: decision.ideas.map((i) => ({ title: i.title, blurb: i.blurb, minutes: i.minutes, from_catalog: !!i.recipe_id })),
        suggestions: [],
        week,
        has_plan: !!planId,
        suggestion: null,
      },
    });
  } catch (e) {
    console.error('assistant-chat: error', (e as { code?: string }).code ?? 'unknown');
    await reportEdgeError(admin, 'assistant-chat', e);
    return fail(500, 'unknown');
  }
});
