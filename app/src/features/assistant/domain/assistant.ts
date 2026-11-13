import type { MealSlot } from '@/features/cooking/domain/cooking';
import type { WeekGoal } from '@/features/plan/domain/plan';

/**
 * Asistente (US-157, US-160, US-173; ADR-025, ADR-029). Cada sugerencia es un dato tipado (receta + comida
 * destino), no texto libre: la base la valida al aplicarla igual que un cambio manual. Puede venir del
 * recetario o haberla creado el asistente con lo que hay en la cocina (siempre validada por la base).
 */
export type AssistantSuggestion = {
  recipeId: string;
  title: string;
  totalMinutes: number;
  coverage: number;
  /** Lo que hay que comprar para hacerla. */
  missing: string[];
  /** true si la creó el asistente (borrador privado de la persona); false si es del recetario. */
  byAssistant: boolean;
  /** Comida del plan que se reemplazaría; null si solo es una idea para cocinar ahora. */
  targetPlannedMealId: string | null;
};

export type AssistantReply = {
  conversationId: string;
  messageId: number;
  reply: string;
  /** true cuando respondió el respaldo sin modelo (sin conexión al LLM o sin clave). */
  fallback: boolean;
  /** De 0 a 3 opciones, en el orden en que las propone. */
  suggestions: AssistantSuggestion[];
  /** US-174: pidió cambiar la semana; las cifras las calculó la base. */
  week: WeekProposal | null;
  /** ¿Tiene un plan? (para ofrecer las metas de la semana cuando la IA no está). */
  hasPlan: boolean;
};

export type WeekProposal = {
  goal: WeekGoal | null;
  avoid: { id: string; name: string }[];
  changes: number;
  saving: number | null;
  unresolved: number;
};

export type AssistantRequest = { conversationId?: string; message: string; plannedMealId?: string };

/** Puerto del asistente. Falla con AppError. */
export interface AssistantRepository {
  send(request: AssistantRequest): Promise<AssistantReply>;
  /** Reemplaza la comida destino por UNA de las recetas sugeridas (RPC apply_assistant_suggestion). */
  apply(messageId: number, recipeId: string): Promise<void>;
}

export type ChatMessage =
  | { id: string; role: 'user'; text: string }
  | {
      id: string;
      role: 'assistant';
      text: string;
      messageId: number;
      suggestions: AssistantSuggestion[];
      fallback: boolean;
      week: WeekProposal | null;
      hasPlan: boolean;
    };

/**
 * US-173: tres pedidos frecuentes como respuestas rápidas. Si se abre para cambiar una comida,
 * los chips hablan de ese cambio; si no, de qué cocinar ahora.
 */
export function quickReplies(changingMeal: boolean, slot: MealSlot): string[] {
  if (changingMeal) return ['quick.swapAnything', 'quick.swapFaster', 'quick.swapPantry'];
  return [slot === 'breakfast' ? 'quick.breakfast' : 'quick.whatNow', 'quick.pantryOnly', 'quick.quick'];
}
