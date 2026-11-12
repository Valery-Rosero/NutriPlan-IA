import type { MealSlot } from '@/features/cooking/domain/cooking';

/** US-159: una comida del día con su nutrición POR PORCIÓN (la versión que se cocinó). */
export type DayMeal = {
  plannedMealId: string;
  slot: MealSlot;
  title: string;
  status: 'planned' | 'cooked';
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type DaySummary = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  cookedCount: number;
  /** Lo que falta por cocinar: se muestra como "pendiente", nunca se cuenta como 0. */
  pending: DayMeal[];
  /** % de la meta diaria de kcal (null sin meta). Informativo, no una indicación médica. */
  kcalPercent: number | null;
  /** % de las kcal del día que vino de proteína (null si aún no hay nada cocinado). */
  proteinPct: number | null;
};

/** Suma SOLO lo cocinado; lo pendiente va aparte (criterio de US-159). */
export function summarizeDay(meals: DayMeal[], kcalTarget: number | null): DaySummary {
  const cooked = meals.filter((m) => m.status === 'cooked');
  const sum = (f: (m: DayMeal) => number) => Math.round(cooked.reduce((acc, m) => acc + f(m), 0) * 10) / 10;
  const kcal = Math.round(sum((m) => m.kcal));
  const proteinG = sum((m) => m.proteinG);
  return {
    kcal,
    proteinG,
    carbsG: sum((m) => m.carbsG),
    fatG: sum((m) => m.fatG),
    cookedCount: cooked.length,
    pending: meals.filter((m) => m.status === 'planned'),
    kcalPercent: kcalTarget ? Math.round((kcal * 100) / kcalTarget) : null,
    proteinPct: kcal > 0 ? Math.round((proteinG * 4 * 100) / kcal) : null,
  };
}

/** Puerto de nutrición. Falla con AppError. */
export interface NutritionRepository {
  day(date?: string): Promise<DayMeal[]>;
}
