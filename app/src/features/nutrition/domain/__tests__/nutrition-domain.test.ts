import { summarizeDay, type DayMeal } from '@/features/nutrition/domain/nutrition';

const meal = (over: Partial<DayMeal>): DayMeal => ({
  plannedMealId: 'm', slot: 'lunch', title: 'x', status: 'cooked', kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, ...over,
});

describe('Mi día (US-159)', () => {
  const day = [
    meal({ plannedMealId: 'b', slot: 'breakfast', title: 'Huevos pericos', kcal: 420, proteinG: 21, carbsG: 30, fatG: 22 }),
    meal({ plannedMealId: 'l', slot: 'lunch', title: 'Sudado', kcal: 580, proteinG: 34, carbsG: 60, fatG: 18 }),
    meal({ plannedMealId: 'd', slot: 'dinner', title: 'Lentejas', status: 'planned', kcal: 500, proteinG: 25 }),
  ];

  it('con 2 de 3 cocinadas suma solo esas 2 y deja la tercera como pendiente (no como 0)', () => {
    const s = summarizeDay(day, 2000);
    expect(s).toMatchObject({ kcal: 1000, proteinG: 55, carbsG: 90, fatG: 40, cookedCount: 2, kcalPercent: 50 });
    expect(s.pending.map((m) => m.title)).toEqual(['Lentejas']);
  });

  it('calcula qué parte de las kcal vino de proteína', () => {
    expect(summarizeDay(day, null).proteinPct).toBe(22); // 55 g × 4 = 220 kcal de 1000
  });

  it('sin meta no inventa porcentaje; sin nada cocinado no hay % de proteína', () => {
    expect(summarizeDay(day, null).kcalPercent).toBeNull();
    expect(summarizeDay([day[2]], 2000)).toMatchObject({ kcal: 0, cookedCount: 0, proteinPct: null, kcalPercent: 0 });
  });
});
