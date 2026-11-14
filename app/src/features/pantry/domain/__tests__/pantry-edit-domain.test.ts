import { addDays, expiryFor, mergeLots, pantryKey, stepFor, type PantryItem } from '@/features/pantry/domain/pantry';

const TODAY = '2026-11-13';
const lot = (over: Partial<PantryItem>): PantryItem => ({
  id: 'x', ingredientId: 'papa', name: 'Papa', grams: 500, expiresOn: null, custom: null, ...over,
});

describe('A6 · el mismo alimento comprado varias veces se ve una sola vez', () => {
  it('junta los lotes vigentes: total y la fecha más próxima, con el detalle de cada compra', () => {
    const a = lot({ id: 'a', grams: 1000, expiresOn: null });
    const b = lot({ id: 'b', grams: 500, expiresOn: addDays(TODAY, 10) });
    const c = lot({ id: 'c', grams: 250, expiresOn: addDays(TODAY, 4) });
    const [papa, ...rest] = mergeLots([a, b, c], TODAY);
    expect(rest).toHaveLength(0);
    expect(papa).toMatchObject({ grams: 1750, expiresOn: addDays(TODAY, 4) });
    expect(papa.lots?.map((l) => l.id)).toEqual(['a', 'b', 'c']);
    expect(pantryKey(papa)).toBe('i:papa');
  });

  it('lo vencido queda aparte (tiene sus propias acciones) y los alimentos propios no se juntan', () => {
    const vencida = lot({ id: 'v', expiresOn: addDays(TODAY, -1) });
    const vigente = lot({ id: 'g' });
    const propio = lot({ id: 'c1', ingredientId: null, name: 'Galletas', grams: 0, custom: { quantity: 2, unit: 'unit' } });
    const merged = mergeLots([vencida, vigente, propio, { ...propio, id: 'c2' }], TODAY);
    expect(merged.map((i) => i.id)).toEqual(['v', 'g', 'c1', 'c2']);
    expect(pantryKey(merged[0])).toBe('c:v');
  });

  it('no cambia los datos originales', () => {
    const a = lot({ id: 'a', grams: 100 });
    mergeLots([a, lot({ id: 'b', grams: 200 })], TODAY);
    expect(a.grams).toBe(100);
  });
});

describe('C3 / A5 · corregir cantidades y fechas', () => {
  it('− / + de a una unidad si el alimento la tiene; si no, de a 100 g; lo propio, en su unidad', () => {
    expect(stepFor(lot({ unitGrams: 50 }))).toBe(50);
    expect(stepFor(lot({ unitGrams: null }))).toBe(100);
    expect(stepFor(lot({ ingredientId: null, custom: { quantity: 2, unit: 'unit' } }))).toBe(1);
    expect(stepFor(lot({ ingredientId: null, custom: { quantity: 300, unit: 'g' } }))).toBe(100);
  });

  it('"Lo normal" usa cuánto dura el alimento; las demás opciones, sus días; "no sé", sin fecha', () => {
    expect(expiryFor('auto', 21, TODAY)).toBe('2026-12-04');
    expect(expiryFor('auto', null, TODAY)).toBeNull();
    expect(expiryFor('week1', 21, TODAY)).toBe('2026-11-20');
    expect(expiryFor('none', 21, TODAY)).toBeNull();
  });
});
