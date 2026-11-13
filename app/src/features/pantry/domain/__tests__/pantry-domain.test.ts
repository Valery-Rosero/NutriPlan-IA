import { addDays, expiryStatus, groupPantry, sortPantry, unitsFor, type FoodGroup, type PantryItem, type Unit } from '@/features/pantry/domain/pantry';

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
    const item = (name: string, expiresOn: string | null): PantryItem => ({ id: name, ingredientId: name, name, grams: 1, expiresOn, custom: null });
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

describe('cocina agrupada: primero lo urgente, luego por grupo de alimento', () => {
  const GROUPS: FoodGroup[] = [
    { id: 5, code: 'dairy', name: 'Lácteos' },
    { id: 9, code: 'grains', name: 'Cereales y derivados' },
    { id: 10, code: 'vegetables', name: 'Verduras' },
    { id: 15, code: 'tubers', name: 'Tubérculos' },
    { id: 2, code: 'poultry', name: 'Aves' },
  ];
  const item = (name: string, expiresOn: string | null, foodGroupId: number | null = null): PantryItem =>
    ({ id: name, ingredientId: name, name, grams: 100, expiresOn, custom: null, foodGroupId });

  it('separa lo vencido y lo que vence pronto; el resto va por grupo en orden de cocina', () => {
    const sections = groupPantry(
      [
        item('Leche', '2026-10-10', 5),
        item('Espinaca', '2026-10-14', 10),
        item('Arroz', null, 9),
        item('Papa', '2026-10-30', 15),
        item('Pollo', null, 2),
        item('Queso', null, 5),
      ],
      '2026-10-13',
      GROUPS,
    );
    expect(sections.map((s) => [s.key, s.data.map((i) => i.name)])).toEqual([
      ['expired', ['Leche']],
      ['soon', ['Espinaca']],
      ['group-poultry', ['Pollo']],
      ['group-dairy', ['Queso']],
      ['group-grains', ['Arroz']],
      ['group-tubers', ['Papa']],
    ]);
    expect(sections[2].group?.name).toBe('Aves');
  });

  it('sin grupo (o con uno que no existe) va a "Otros", al final', () => {
    const sections = groupPantry([item('Bolsas', null), item('Raro', null, 99), item('Arroz', null, 9)], '2026-10-13', GROUPS);
    expect(sections.map((s) => s.key)).toEqual(['group-grains', 'group-other']);
    expect(sections[1].data.map((i) => i.name)).toEqual(['Bolsas', 'Raro']);
  });
});
