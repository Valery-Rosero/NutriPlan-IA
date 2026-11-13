import type { MealSlot } from '@/features/cooking/domain/cooking';

export type MealStatus = 'planned' | 'cooked' | 'skipped';
export type PlanStatus = 'draft' | 'confirmed' | 'archived';

export type PlannedMeal = {
  id: string;
  date: string;
  slot: MealSlot;
  recipeId: string;
  recipeTitle: string;
  totalMinutes: number;
  servings: number;
  status: MealStatus;
  reasonCode: string | null;
};

export type MealPlan = {
  id: string;
  startDate: string;
  endDate: string;
  status: PlanStatus;
  budgetLimit: number | null;
  /** Solo lo PLANEADO (una comida por momento del día). */
  meals: PlannedMeal[];
  /**
   * Platos adicionales: lo que se cocinó fuera del plan en estos días (una receta del asistente, una
   * sugerencia de "¿Qué cocino?"). Siempre cocinados; no cuentan en el avance ni en el costo del plan.
   */
  extras: PlannedMeal[];
};

export type BudgetStatus = {
  estimatedCost: number;
  budgetLimit: number | null;
  overBy: number | null;
  missingPrices: number;
};

export type RecipeSummary = { id: string; title: string; totalMinutes: number };

/**
 * US-152: cambiar una comida por otra receta elegible más barata. Los dos costos y el ahorro vienen
 * redondeados de la base y cuadran exacto (ahorro = actual − alternativa).
 */
export type SavingSuggestion = {
  plannedMealId: string;
  date: string;
  slot: MealSlot;
  currentRecipeId: string;
  currentTitle: string;
  currentCost: number;
  alternativeRecipeId: string;
  alternativeTitle: string;
  alternativeCost: number;
  saving: number;
};

/** Por qué cambió una comida: la pidió la persona o fue para ahorrar. */
export type SwapReason = 'user_request' | 'budget_friendly';

export type GeneratePlanInput = { start: string; days: number; slots: MealSlot[] };

/** B2: se planea por día, semana o mes (el generador acepta de 1 a 31 días). */
export const HORIZON_DAYS = { day: 1, week: 7, month: 30 } as const;
export type Horizon = keyof typeof HORIZON_DAYS;

/** La duración más cercana a un plan existente (para "volver a generar" con la misma). */
export function horizonOf(days: number): Horizon {
  if (days <= 1) return 'day';
  return days <= 7 ? 'week' : 'month';
}

/** Puerto del plan semanal. Falla con AppError. */
export interface PlanRepository {
  /** El plan vigente hoy o el próximo (sin archivados). */
  current(today: string): Promise<MealPlan | null>;
  /** Genera con reglas en la base (ADR-023): solo recetas elegibles. Devuelve el id del plan. */
  generate(input: GeneratePlanInput): Promise<string>;
  budget(planId: string): Promise<BudgetStatus>;
  /** Recetas elegibles para ese momento del día (las mismas reglas de seguridad). */
  alternatives(slot: MealSlot, excludeRecipeId: string): Promise<RecipeSummary[]>;
  swap(mealId: string, recipeId: string, previousRecipeId: string, reason?: SwapReason): Promise<void>;
  /** US-152: reemplazos más baratos para las comidas pendientes (sugiere, no aplica). */
  savings(planId: string): Promise<SavingSuggestion[]>;
  skip(mealId: string): Promise<void>;
  confirm(planId: string): Promise<void>;
}

export const SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export type PlanDay = { date: string; meals: PlannedMeal[] };

/** Comidas agrupadas por día y ordenadas por momento del día. */
export function groupByDay(meals: PlannedMeal[]): PlanDay[] {
  const days = new Map<string, PlannedMeal[]>();
  for (const meal of meals) days.set(meal.date, [...(days.get(meal.date) ?? []), meal]);
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({ date, meals: list.sort((x, y) => SLOT_ORDER.indexOf(x.slot) - SLOT_ORDER.indexOf(y.slot)) }));
}

export type BudgetLevel = 'none' | 'ok' | 'near' | 'over';

/** US-132: alerta al pasarse; aviso previo al llegar al 90 %. */
export function budgetLevel(status: BudgetStatus): BudgetLevel {
  if (status.budgetLimit === null) return 'none';
  if ((status.overBy ?? 0) > 0) return 'over';
  return status.estimatedCost >= status.budgetLimit * 0.9 ? 'near' : 'ok';
}
