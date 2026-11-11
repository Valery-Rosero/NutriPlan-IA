import { spendLevel, type MonthlySpend } from '@/features/spending/domain/spending';

const spend = (percent: number | null, monthlyBudget: number | null = 60000): MonthlySpend => ({
  monthStart: '2026-11-01', spent: 0, purchases: 0, monthlyBudget, percent,
});

describe('gasto del mes (US-141)', () => {
  it.each([
    [64, 'ok'],
    [90, 'near'],
    [100, 'near'],
    [101, 'over'],
  ] as const)('%i %% → %s', (percent, level) => {
    expect(spendLevel(spend(percent))).toBe(level);
  });

  it('sin presupuesto no hay nivel', () => {
    expect(spendLevel(spend(null, null))).toBe('none');
  });
});
