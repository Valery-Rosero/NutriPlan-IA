import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';

import { AppError, toAppError } from '@/core/errors/app-error';
import type { AssistantReply, AssistantRepository, AssistantRequest, AssistantSuggestion } from '@/features/assistant/domain/assistant';
import type { WeekGoal } from '@/features/plan/domain/plan';
import type { Database } from '@/types/database';

type RemoteSuggestion = {
  recipe_id: string;
  title: string;
  total_minutes: number;
  coverage: number;
  missing: string[];
  by_assistant: boolean;
};

type Payload = {
  ok: boolean;
  data?: {
    conversation_id: string;
    message_id: number;
    reply: string;
    fallback: boolean;
    target_planned_meal_id?: string | null;
    /** ADR-029: hasta tres opciones. Ausente si la función es anterior (solo `suggestion`). */
    suggestions?: RemoteSuggestion[];
    /** US-174: propuesta de cambios a la semana. Ausente si la función es anterior. */
    week?: { goal: WeekGoal | null; avoid: { id: string; name: string }[]; changes: number; saving: number | null; unresolved: number } | null;
    has_plan?: boolean;
    /** ADR-037: la lista de platos. Ausente si la función es anterior. */
    ideas?: { title: string; blurb: string; minutes: number; from_catalog: boolean }[];
    suggestion: {
      recipe_id: string;
      title: string;
      total_minutes: number;
      coverage: number;
      target_planned_meal_id: string | null;
    } | null;
  };
  error?: { code: string };
};

type FillPayload = {
  ok: boolean;
  data?: { suggestion: RemoteSuggestion & { target_planned_meal_id: string | null } };
  error?: { code: string };
};

/** La función responde { ok:false, error:{ code } }: se traduce a un código de la app. */
async function functionError(error: unknown) {
  const body = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
  return toAppError(body?.error?.code ?? error);
}

const toSuggestion = (s: RemoteSuggestion, target: string | null): AssistantSuggestion => ({
  recipeId: s.recipe_id,
  title: s.title,
  totalMinutes: s.total_minutes,
  coverage: s.coverage,
  missing: s.missing ?? [],
  byAssistant: !!s.by_assistant,
  targetPlannedMealId: target,
});

export class SupabaseAssistantRepository implements AssistantRepository {
  private readonly client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  async send({ conversationId, message, plannedMealId }: AssistantRequest): Promise<AssistantReply> {
    const { data, error } = await this.client.functions.invoke<Payload>('assistant-chat', {
      body: { conversation_id: conversationId, message, planned_meal_id: plannedMealId },
    });
    if (error) throw await functionError(error);
    if (!data?.ok || !data.data) throw new AppError('unknown');
    const d = data.data;
    const target = d.target_planned_meal_id ?? d.suggestion?.target_planned_meal_id ?? null;
    const remote: RemoteSuggestion[] =
      d.suggestions ?? (d.suggestion ? [{ ...d.suggestion, missing: [], by_assistant: false }] : []);
    return {
      conversationId: d.conversation_id,
      messageId: d.message_id,
      reply: d.reply,
      fallback: d.fallback,
      ideas: (d.ideas ?? []).map((i) => ({ title: i.title, blurb: i.blurb, minutes: i.minutes, fromCatalog: !!i.from_catalog })),
      targetPlannedMealId: target,
      suggestions: remote.map((s) => toSuggestion(s, target)),
      week: d.week ?? null,
      hasPlan: !!d.has_plan,
    };
  }

  async fill(conversationId: string, messageId: number, idea: number) {
    const { data, error } = await this.client.functions.invoke<FillPayload>('assistant-chat', {
      body: { action: 'fill', conversation_id: conversationId, message_id: messageId, idea },
    });
    if (error) throw await functionError(error);
    if (!data?.ok || !data.data) throw new AppError('unknown');
    const s = data.data.suggestion;
    return toSuggestion(s, s.target_planned_meal_id);
  }

  async apply(messageId: number, recipeId: string) {
    const { error } = await this.client.rpc('apply_assistant_suggestion', { p_message_id: messageId, p_recipe_id: recipeId });
    if (error) throw toAppError(error);
  }
}
