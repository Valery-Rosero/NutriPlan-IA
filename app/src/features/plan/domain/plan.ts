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
  meals: PlannedMeal[];
};

export type BudgetStatus = {
  estimatedCost: number;
  budgetLimit: number | null;
  overBy: number | null;
  missingPrices: number;
};

export type RecipeSummary = { id: string; title: string; totalMinutes: number };

export type GeneratePlanInput = { start: string; days: number; slots: MealSlot[] };

/** Puerto del plan semanal. Falla con AppError. */
export interface PlanRepository {
  /** El plan vigente hoy o el próximo (sin archivados). */
  current(today: string): Promise<MealPlan | null>;
  /** Genera con reglas en la base (ADR-023): solo recetas elegibles. Devuelve el id del plan. */
  generate(input: GeneratePlanInput): Promise<string>;
  budget(planId: string): Promise<BudgetStatus>;
  /** Recetas elegibles para ese momento del día (las mismas reglas de seguridad). */
  alternatives(slot: MealSlot, excludeRecipeId: string): Promise<RecipeSummary[]>;
  swap(mealId: string, recipeId: string, previousRecipeId: string): Promise<void>;
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
