import type { MealSlot } from '@/features/cooking/domain/cooking';

/**
 * Asistente (US-157, US-160, US-173; ADR-025). La sugerencia es un dato tipado (receta + comida destino),
 * no texto libre: la base la valida al aplicarla igual que un cambio manual.
 */
export type AssistantSuggestion = {
  recipeId: string;
  title: string;
  totalMinutes: number;
  coverage: number;
  /** Comida del plan que se reemplazaría; null si solo es una idea para cocinar ahora. */
  targetPlannedMealId: string | null;
};

export type AssistantReply = {
  conversationId: string;
  messageId: number;
  reply: string;
  /** true cuando respondió el respaldo sin modelo (sin conexión al LLM o sin clave). */
  fallback: boolean;
  suggestion: AssistantSuggestion | null;
};

export type AssistantRequest = { conversationId?: string; message: string; plannedMealId?: string };

/** Puerto del asistente. Falla con AppError. */
export interface AssistantRepository {
  send(request: AssistantRequest): Promise<AssistantReply>;
  /** Reemplaza la comida destino por la receta sugerida (RPC apply_assistant_suggestion). */
  apply(messageId: number): Promise<void>;
}

export type ChatMessage =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; text: string; messageId: number; suggestion: AssistantSuggestion | null; fallback: boolean };

/**
 * US-173: tres pedidos frecuentes como respuestas rápidas. Si se abre para cambiar una comida,
 * los chips hablan de ese cambio; si no, de qué cocinar ahora.
 */
export function quickReplies(changingMeal: boolean, slot: MealSlot): string[] {
  if (changingMeal) return ['quick.swapAnything', 'quick.swapFaster', 'quick.swapPantry'];
  return [slot === 'breakfast' ? 'quick.breakfast' : 'quick.whatNow', 'quick.pantryOnly', 'quick.quick'];
}
