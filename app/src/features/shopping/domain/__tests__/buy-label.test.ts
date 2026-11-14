import i18n from '@/infrastructure/i18n';
import { buyLabel, type BuyKind } from '@/features/shopping/domain/shopping';
import { roundedCOP } from '@/features/spending/ui/monthly-spend-card';

const t = i18n.t.bind(i18n) as (k: string, o?: Record<string, unknown>) => string;
const label = (buyKind: BuyKind, buyGrams: number, buyUnits: number | null = null) => buyLabel({ buyKind, buyGrams, buyUnits, toBuyGrams: buyGrams }, t);

describe('A2 · cuánto comprar, como se pide en la plaza (ADR-035)', () => {
  it.each([
    ['unit', 150, 3, '3 unidades'],
    ['unit', 50, 1, '1 unidad'],
    ['pinch', 10, null, 'un poco'],
    ['piece', 250, null, 'un pedazo pequeño'],
    ['weight', 250, null, 'media libra'],
    ['weight', 500, null, '1 libra'],
    ['weight', 750, null, '1 libra y media'],
    ['weight', 1000, null, '2 libras'],
    ['weight', 2750, null, '5 libras y media'],
    ['weight', 3500, null, '3,5 kg'],
    ['ml', 250, null, 'un cuarto de litro'],
    ['ml', 500, null, 'medio litro'],
    ['ml', 750, null, 'tres cuartos de litro'],
    ['ml', 1000, null, '1 litro'],
    ['ml', 1500, null, '1 litro y medio'],
    ['ml', 2000, null, '2 litros'],
  ] as const)('%s %d g → "%s"', (kind, grams, units, expected) => {
    expect(label(kind, grams, units)).toBe(expected);
  });

  it('sin forma de compra conocida (lo escrito a mano) no inventa nada', () => {
    expect(label('none', 0)).toBeNull();
  });
});

describe('M3 · el presupuesto del mes se ve redondeado', () => {
  it('"$857.143" → "≈ $857.000"; una cifra redonda queda igual', () => {
    expect(roundedCOP(857143)).toMatch(/^≈ \$\s?857\.000$/);
    expect(roundedCOP(600000)).toMatch(/^\$\s?600\.000$/);
  });
});
