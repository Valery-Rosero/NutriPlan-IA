import { addDays, expiryStatus, groupByUrgency, sortPantry, unitsFor, type PantryItem, type Unit } from '@/features/pantry/domain/pantry';

const units: Unit[] = [
  { id: 1, code: 'g', name: 'gramo', dimension: 'mass' },
  { id: 2, code: 'kg', name: 'kilogramo', dimension: 'mass' },
  { id: 3, code: 'ml', name: 'mililitro', dimension: 'volume' },
  { id: 4, code: 'unit', name: 'unidad', dimension: 'count' },
  { id: 5, code: 'lb', name: 'libra (500 g)', dimension: 'mass' },
];

describe('vencimientos (US-142)', () => {
  it.each([
    [null, 'none'],
    ['2026-10-12', 'expired'],
    ['2026-10-13', 'soon'],
    ['2026-10-16', 'soon'],
    ['2026-10-17', 'ok'],
  ] as const)('%s → %s (hoy 2026-10-13)', (date, status) => {
    expect(expiryStatus(date, '2026-10-13')).toBe(status);
  });

  it('suma días sobre la fecha ISO', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
  });

  it('ordena: primero lo que vence, al final lo que no tiene fecha', () => {
    const item = (name: string, expiresOn: string | null): PantryItem => ({ id: name, ingredientId: name, name, grams: 1, expiresOn });
    const sorted = sortPantry([item('Arroz', null), item('Leche', '2026-10-20'), item('Huevo', '2026-10-15')]);
    expect(sorted.map((i) => i.name)).toEqual(['Huevo', 'Leche', 'Arroz']);
  });
});

describe('unidades ofrecidas', () => {
  it('ofrece las contables del ingrediente y masa (g, libra, kg), nunca volumen', () => {
    const offered = unitsFor({ id: 'papa', name: 'Papa', countUnits: [units[3]] }, units).map((u) => u.code);
    expect(offered).toEqual(['unit', 'g', 'lb', 'kg']);
  });
});

describe('cocina agrupada por urgencia', () => {
  const item = (name: string, expiresOn: string | null): PantryItem => ({ id: name, ingredientId: name, name, grams: 100, expiresOn });

  it('separa lo vencido, lo que vence pronto y el resto, sin grupos vacíos', () => {
    const groups = groupByUrgency(
      [item('Leche', '2026-10-10'), item('Espinaca', '2026-10-14'), item('Arroz', null), item('Papa', '2026-10-30')],
      '2026-10-13',
    );
    expect(groups.map((g) => [g.key, g.data.map((i) => i.name)])).toEqual([
      ['expired', ['Leche']],
      ['soon', ['Espinaca']],
      ['rest', ['Arroz', 'Papa']],
    ]);
    expect(groupByUrgency([item('Arroz', null)], '2026-10-13').map((g) => g.key)).toEqual(['rest']);
  });
});
