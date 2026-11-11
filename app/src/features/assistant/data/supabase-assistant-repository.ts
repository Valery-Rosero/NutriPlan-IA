import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';

import { AppError, toAppError } from '@/core/errors/app-error';
import type { AssistantReply, AssistantRepository, AssistantRequest } from '@/features/assistant/domain/assistant';
import type { Database } from '@/types/database';

type Payload = {
  ok: boolean;
  data?: {
    conversation_id: string;
    message_id: number;
    reply: string;
    fallback: boolean;
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
    return {
      conversationId: d.conversation_id,
      messageId: d.message_id,
      reply: d.reply,
      fallback: d.fallback,
      suggestion: d.suggestion && {
        recipeId: d.suggestion.recipe_id,
        title: d.suggestion.title,
        totalMinutes: d.suggestion.total_minutes,
        coverage: d.suggestion.coverage,
        targetPlannedMealId: d.suggestion.target_planned_meal_id,
      },
    };
  }

  async apply(messageId: number) {
    const { error } = await this.client.rpc('apply_assistant_suggestion', { p_message_id: messageId });
    if (error) throw toAppError(error);
  }
}
