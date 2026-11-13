import { groupByDay, type MealPlan, type PlannedMeal } from '@/features/plan/domain/plan';

/**
 * Calendario de Mi semana (B1): arriba, la tira de la semana o el mes; abajo, una "página" por día.
 * Fechas siempre en ISO (AAAA-MM-DD) y en UTC para no depender de la zona horaria del teléfono.
 */

/** Hasta este número de días se muestra la tira; más, la cuadrícula del mes. */
export const STRIP_MAX_DAYS = 7;

export type DayState = 'empty' | 'pending' | 'partial' | 'done';

export type CalendarDay = {
  date: string;
  /** El día está dentro del plan (los de relleno de la cuadrícula no). */
  inPlan: boolean;
  isToday: boolean;
  meals: PlannedMeal[];
  state: DayState;
};

const DAY_MS = 86_400_000;

export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = lunes … 6 = domingo (semana colombiana). */
export function weekdayIndex(iso: string): number {
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export function dayNumber(iso: string): number {
  return Number(iso.slice(8, 10));
}

/** Todas las fechas del plan, de inicio a fin, aunque algún día no tenga comidas. */
export function planDates(plan: Pick<MealPlan, 'startDate' | 'endDate'>): string[] {
  const dates: string[] = [];
  for (let d = plan.startDate; d <= plan.endDate && dates.length < 62; d = addDays(d, 1)) dates.push(d);
  return dates;
}

/** Hecho = todo cocinado u omitido; a medias = algo cocinado; pendiente = nada aún; vacío = sin comidas. */
export function dayState(meals: PlannedMeal[]): DayState {
  if (meals.length === 0) return 'empty';
  const finished = meals.filter((m) => m.status !== 'planned').length;
  if (finished === meals.length) return 'done';
  return meals.some((m) => m.status === 'cooked') ? 'partial' : 'pending';
}

/** Las páginas del libro: un día del plan por página, con sus comidas en orden del día. */
export function calendarDays(plan: MealPlan, today: string): CalendarDay[] {
  const byDate = new Map(groupByDay(plan.meals).map((d) => [d.date, d.meals]));
  return planDates(plan).map((date) => {
    const meals = byDate.get(date) ?? [];
    return { date, inPlan: true, isToday: date === today, meals, state: dayState(meals) };
  });
}

export function calendarLayout(plan: MealPlan): 'strip' | 'month' {
  return planDates(plan).length > STRIP_MAX_DAYS ? 'month' : 'strip';
}

/** Página con la que abre: hoy si está en el plan; si el plan ya pasó, el último día; si no ha empezado, el primero. */
export function initialDayIndex(days: CalendarDay[], today: string): number {
  if (days.length === 0) return 0;
  const todayIndex = days.findIndex((d) => d.date === today);
  if (todayIndex >= 0) return todayIndex;
  return today > days[days.length - 1].date ? days.length - 1 : 0;
}

/**
 * Cuadrícula del mes (planes de más de 7 días): semanas de lunes a domingo que cubren el plan.
 * Las celdas fuera del plan se muestran apagadas (inPlan = false) para que la semana se lea completa.
 */
export function monthWeeks(days: CalendarDay[], today: string): CalendarDay[][] {
  if (days.length === 0) return [];
  const byDate = new Map(days.map((d) => [d.date, d]));
  const first = addDays(days[0].date, -weekdayIndex(days[0].date));
  const last = days[days.length - 1].date;
  const lastSunday = addDays(last, 6 - weekdayIndex(last));
  const weeks: CalendarDay[][] = [];
  for (let start = first; start <= lastSunday; start = addDays(start, 7)) {
    weeks.push(
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(start, i);
        return byDate.get(date) ?? { date, inPlan: false, isToday: date === today, meals: [], state: 'empty' as const };
      }),
    );
  }
  return weeks;
}
