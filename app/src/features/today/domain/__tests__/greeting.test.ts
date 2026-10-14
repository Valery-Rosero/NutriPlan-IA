import { greetingFor } from '@/features/today/domain/greeting';

describe('saludo de Hoy', () => {
  it.each([
    [0, 'morning'],
    [11, 'morning'],
    [12, 'afternoon'],
    [18, 'afternoon'],
    [19, 'evening'],
    [23, 'evening'],
  ])('a las %i h saluda con %s', (hour, expected) => {
    expect(greetingFor(hour)).toBe(expected);
  });
});
