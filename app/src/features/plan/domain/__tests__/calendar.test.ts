import {
  addDays,
  calendarDays,
  calendarLayout,
  dayState,
  initialDayIndex,
  monthWeeks,
  planDates,
  weekdayIndex,
} from '@/features/plan/domain/calendar';
import type { MealPlan, PlannedMeal } from '@/features/plan/domain/plan';

const meal = (over: Partial<PlannedMeal>): PlannedMeal => ({
  id: 'm', date: '2026-11-13', slot: 'lunch', recipeId: 'r', recipeTitle: 'Receta', totalMinutes: 30, servings: 2,
  status: 'planned', reasonCode: null, ...over,
});
const plan = (startDate: string, endDate: string, meals: PlannedMeal[] = []): MealPlan => ({
  id: 'p', startDate, endDate, status: 'confirmed', budgetLimit: null, meals, extras: [],
});

describe('calendario de Mi semana (B1)', () => {
  it('fechas: suma días y sabe el día de la semana (lunes = 0)', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(weekdayIndex('2026-11-16')).toBe(0); // lunes
    expect(weekdayIndex('2026-11-15')).toBe(6); // domingo
  });

  it('el plan incluye todos sus días, aunque alguno no tenga comidas', () => {
    expect(planDates(plan('2026-11-13', '2026-11-15'))).toEqual(['2026-11-13', '2026-11-14', '2026-11-15']);
  });

  it('estado del día: vacío, pendiente, a medias o hecho', () => {
    expect(dayState([])).toBe('empty');
    expect(dayState([meal({}), meal({})])).toBe('pending');
    expect(dayState([meal({ status: 'cooked' }), meal({})])).toBe('partial');
    expect(dayState([meal({ status: 'cooked' }), meal({ status: 'skipped' })])).toBe('done');
  });

  it('hasta 7 días se ve la tira; más, el mes', () => {
    expect(calendarLayout(plan('2026-11-13', '2026-11-13'))).toBe('strip');
    expect(calendarLayout(plan('2026-11-13', '2026-11-19'))).toBe('strip');
    expect(calendarLayout(plan('2026-11-13', '2026-12-12'))).toBe('month');
  });

  it('las comidas de cada página van en orden del día', () => {
    const days = calendarDays(
      plan('2026-11-13', '2026-11-14', [meal({ id: 'cena', slot: 'dinner' }), meal({ id: 'desayuno', slot: 'breakfast' })]),
      '2026-11-13',
    );
    expect(days[0].meals.map((m) => m.id)).toEqual(['desayuno', 'cena']);
    expect(days[0].isToday).toBe(true);
    expect(days[1].state).toBe('empty');
  });

  it('abre en hoy; si el plan ya pasó, en el último día; si no ha empezado, en el primero', () => {
    const days = calendarDays(plan('2026-11-13', '2026-11-19'), '2026-11-15');
    expect(initialDayIndex(days, '2026-11-15')).toBe(2);
    expect(initialDayIndex(days, '2026-11-30')).toBe(6);
    expect(initialDayIndex(days, '2026-11-01')).toBe(0);
  });

  it('el mes se arma en semanas de lunes a domingo, con los días fuera del plan apagados', () => {
    const days = calendarDays(plan('2026-11-13', '2026-11-24'), '2026-11-13'); // viernes 13 → martes 24
    const weeks = monthWeeks(days, '2026-11-13');
    expect(weeks).toHaveLength(3);
    expect(weeks[0][0].date).toBe('2026-11-09'); // lunes de esa semana
    expect(weeks[0][0].inPlan).toBe(false);
    expect(weeks[0][4]).toMatchObject({ date: '2026-11-13', inPlan: true, isToday: true });
    expect(weeks[2][6].date).toBe('2026-11-29');
    expect(weeks.flat().every((d) => d.date.length === 10)).toBe(true);
  });

  it('los platos adicionales van aparte y no cambian el estado del día', () => {
    const base = plan('2026-11-13', '2026-11-13', [meal({ id: 'almuerzo' })]);
    const days = calendarDays({ ...base, extras: [meal({ id: 'batido', slot: 'snack', status: 'cooked' })] }, '2026-11-13');
    expect(days[0].meals.map((m) => m.id)).toEqual(['almuerzo']);
    expect(days[0].extras.map((m) => m.id)).toEqual(['batido']);
    expect(days[0].state).toBe('pending'); // un batido cocinado no marca el día "a medias"
  });
});
