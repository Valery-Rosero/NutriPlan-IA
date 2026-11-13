import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';

import { AppError, toAppError } from '@/core/errors/app-error';
import type { AssistantReply, AssistantRepository, AssistantRequest } from '@/features/assistant/domain/assistant';
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

export class SupabaseAssistantRepository implements AssistantRepository {
  private readonly client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  async send({ conversationId, message, plannedMealId }: AssistantRequest): Promise<AssistantReply> {
    const { data, error } = await this.client.functions.invoke<Payload>('assistant-chat', {
      body: { conversation_id: conversationId, message, planned_meal_id: plannedMealId },
    });
    if (error) {
      // La función responde { ok:false, error:{ code } }: se traduce a un código de la app.
      const body = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
      throw toAppError(body?.error?.code ?? error);
    }
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
      suggestions: remote.map((s) => ({
        recipeId: s.recipe_id,
        title: s.title,
        totalMinutes: s.total_minutes,
        coverage: s.coverage,
        missing: s.missing ?? [],
        byAssistant: !!s.by_assistant,
        targetPlannedMealId: target,
      })),
      week: d.week ?? null,
      hasPlan: !!d.has_plan,
    };
  }

  async apply(messageId: number, recipeId: string) {
    const { error } = await this.client.rpc('apply_assistant_suggestion', { p_message_id: messageId, p_recipe_id: recipeId });
    if (error) throw toAppError(error);
  }
}
