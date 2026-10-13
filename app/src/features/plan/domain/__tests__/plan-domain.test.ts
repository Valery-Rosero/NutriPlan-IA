import { budgetLevel, groupByDay } from '@/features/plan/domain/plan';
import { PLAN } from '@/test/fakes';

describe('groupByDay', () => {
  it('agrupa por fecha y ordena desayuno → almuerzo → algo → cena', () => {
    const days = groupByDay([
      ...PLAN.meals,
      { ...PLAN.meals[0], id: 'm3', date: '2026-10-12', slot: 'breakfast' },
    ]);
    expect(days.map((d) => d.date)).toEqual(['2026-10-12', '2026-10-13']);
    expect(days[1].meals.map((m) => m.slot)).toEqual(['lunch', 'dinner']);
  });
});

describe('budgetLevel (US-132)', () => {
  const base = { estimatedCost: 0, budgetLimit: 100000, overBy: 0, missingPrices: 0 };
  it.each([
    [{ ...base, budgetLimit: null }, 'none'],
    [{ ...base, estimatedCost: 50000 }, 'ok'],
    [{ ...base, estimatedCost: 95000 }, 'near'],
    [{ ...base, estimatedCost: 110000, overBy: 10000 }, 'over'],
  ] as const)('%j → %s', (status, level) => {
    expect(budgetLevel(status)).toBe(level);
  });
});
