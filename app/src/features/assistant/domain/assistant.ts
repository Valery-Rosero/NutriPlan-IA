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

/**
 * ADR-037 · IA primero: un plato de la lista (nombre, una frase y minutos). Al elegirlo, la IA llena la receta
 * (fill). `fromCatalog`: idea del recetario (respaldo cuando la IA no responde).
 */
export type AssistantIdea = { title: string; blurb: string; minutes: number; fromCatalog: boolean };

export type AssistantReply = {
  conversationId: string;
  messageId: number;
  reply: string;
  /** true cuando respondió el respaldo sin modelo (sin conexión al LLM o sin clave). */
  fallback: boolean;
  /** ADR-037: la lista de 4–5 platos (vacía si pidió cambiar la semana o no correspondía proponer). */
  ideas: AssistantIdea[];
  /** Comida del plan que se quiere cambiar (si se abrió para eso). */
  targetPlannedMealId: string | null;
  /** Versiones anteriores de la función: recetas ya armadas. */
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
  /** ADR-037: la IA llena la receta de la idea elegida (la base la valida). Falla con recipe_not_created. */
  fill(conversationId: string, messageId: number, idea: number): Promise<AssistantSuggestion>;
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
      conversationId: string;
      ideas: AssistantIdea[];
      targetPlannedMealId: string | null;
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

/**
 * A veces el modelo escribe una lista en una sola línea ("Te propongo: - **Sudado** - **Arroz**"). Cada viñeta
 * va a su renglón para que se lea como lista.
 */
export function tidyChatMarkdown(text: string): string {
  return text
    .replace(/[ \t]+[-•*][ \t]+(?=\*\*)/g, '\n- ')
    .replace(/[ \t]+(\d+)\.[ \t]+(?=\*\*)/g, '\n$1. ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
