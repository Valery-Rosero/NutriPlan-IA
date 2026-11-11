// Edge Function assistant-chat (US-157, US-160; contrato en docs/02-arquitectura/edge-functions.md §2, ADR-025).
// El LLM propone, la BD dispone: las candidatas salen de la base con el JWT de la persona (ya filtradas por
// alergias, dietas y tiempo), el modelo elige una, se valida aquí y se aplica con apply_assistant_suggestion.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { askGemini, type LlmTurn } from './llm.ts';
import { fallbackDecision, requestSchema, slotForNow, systemPrompt, validateAnswer, type Candidate, type Target } from './logic.ts';

type ErrorCode = 'method_not_allowed' | 'not_authenticated' | 'invalid_input' | 'quota_exceeded' | 'meal_not_found' | 'unknown';

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
  // Como la persona (RLS): todo lo que lee y elige pasa por sus permisos y restricciones.
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

  try {
    // Cuota diaria (ADR-025)
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { count } = await admin
      .from('ai_generations').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).gte('created_at', since);
    if ((count ?? 0) >= DAILY_QUOTA) return fail(429, 'quota_exceeded');

    // Comida destino (si viene): debe ser de la persona y seguir pendiente.
    let target: Target = null;
    if (planned_meal_id) {
      const { data: meal } = await user
        .from('planned_meals').select('id, slot, status, recipes(title)')
        .eq('id', planned_meal_id).maybeSingle();
      if (!meal || meal.status !== 'planned') return fail(404, 'meal_not_found');
      target = { planned_meal_id: meal.id, slot: meal.slot, current_title: (meal.recipes as { title: string } | null)?.title ?? '' };
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

    // Candidatas seguras para la persona (eligible_recipes adentro).
    const { data: rows, error: candError } = await user.rpc('cook_with_what_i_have', { p_slot: slot, p_limit: 12 });
    if (candError) throw candError;
    const candidates = (rows ?? []) as Candidate[];

    // El modelo elige; si falla, respaldo determinista.
    const turns: LlmTurn[] = [
      ...(history ?? []).reverse().map((m) => ({ role: m.role as 'user' | 'assistant', text: m.content })),
      { role: 'user', text: message },
    ];
    const started = Date.now();
    let decision = null;
    let usage: { model: string; inputTokens: number | null; outputTokens: number | null } | null = null;
    try {
      const answer = await askGemini(systemPrompt(slot, candidates, target), turns);
      usage = answer;
      decision = validateAnswer(answer.raw, candidates);
    } catch (e) {
      console.warn('assistant-chat: llm no disponible', (e as Error).message); // sin contenido de la persona
    }
    decision ??= fallbackDecision(candidates, target);

    const suggestion = decision.recipeId ? candidates.find((c) => c.recipe_id === decision.recipeId) ?? null : null;
    const { data: saved, error: saveError } = await admin
      .from('assistant_messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: decision.reply,
        suggested_recipe_id: suggestion?.recipe_id ?? null,
        target_planned_meal_id: suggestion && target ? target.planned_meal_id : null,
      })
      .select('id')
      .single();
    if (saveError) throw saveError;

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
        suggestion: suggestion && {
          recipe_id: suggestion.recipe_id,
          title: suggestion.title,
          total_minutes: suggestion.total_minutes,
          coverage: suggestion.coverage,
          target_planned_meal_id: target?.planned_meal_id ?? null,
        },
      },
    });
  } catch (e) {
    console.error('assistant-chat: error', (e as { code?: string }).code ?? 'unknown');
    return fail(500, 'unknown');
  }
});
