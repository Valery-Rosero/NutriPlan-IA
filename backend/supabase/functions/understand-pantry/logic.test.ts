// Pruebas de understand-pantry (ADR-030). Corren con `npm run test:functions` desde app/.
import { match, photoPrompt, rulesParse, systemPrompt, validateItems, validatePhoto, type CatalogIngredient } from './logic.ts';

const catalog: CatalogIngredient[] = [ // I1…I6
  { id: 'papa', name: 'Papa', shelf_life_days: 30, units: ['unit', 'g', 'lb', 'kg'] },
  { id: 'criolla', name: 'Papa criolla', shelf_life_days: 15, units: ['g', 'lb', 'kg'] },
  { id: 'huevo', name: 'Huevo', shelf_life_days: 21, units: ['unit', 'g', 'lb', 'kg'] },
  { id: 'tomate', name: 'Tomate', shelf_life_days: 7, units: ['unit', 'g', 'lb', 'kg'] },
  { id: 'limon', name: 'Limón', shelf_life_days: 14, units: ['unit', 'g', 'lb', 'kg'] },
  { id: 'frijol', name: 'Fríjol rojo seco', shelf_life_days: 365, units: ['g', 'lb', 'kg'] },
];

describe('validar lo que entiende la IA', () => {
  it('separa varias cosas, las relaciona con el catálogo y propone vencimiento', () => {
    const items = validateItems({
      items: [
        { ref: 'I2', name: 'papa criolla', quantity: 2, unit: 'lb', expires_in_days: null },
        { ref: 'I3', name: 'huevos', quantity: 6, unit: 'unit', expires_in_days: 20 },
        { ref: null, name: 'queso crema', quantity: 1, unit: 'unit', expires_in_days: 10 },
      ],
    }, catalog);
    expect(items).toEqual([
      { ingredient_id: 'criolla', name: 'Papa criolla', quantity: 2, unit: 'lb', units: ['g', 'lb', 'kg'], expires_in_days: 15, uncertain: false },
      { ingredient_id: 'huevo', name: 'Huevo', quantity: 6, unit: 'unit', units: ['unit', 'g', 'lb', 'kg'], expires_in_days: 20, uncertain: false },
      { ingredient_id: null, name: 'Queso crema', quantity: 1, unit: 'unit', units: ['g', 'kg', 'lb', 'unit', 'ml', 'l'], expires_in_days: 10, uncertain: false },
    ]);
  });

  it('una unidad que no sirve para ese ingrediente queda en una válida (para revisar)', () => {
    const [item] = validateItems({ items: [{ ref: 'I2', name: 'papa criolla', quantity: 3, unit: 'l' }] }, catalog)!;
    expect(item.unit).toBe('g');
  });

  it('descarta referencias inventadas y cosas mal formadas; si nada sirve, null (reglas)', () => {
    expect(validateItems({ items: [{ ref: 'I99', name: 'x', quantity: 1, unit: 'unit' }] }, catalog)).toBeNull();
    expect(validateItems({ items: [{ ref: 'I1', name: 'papa', quantity: -2, unit: 'kg' }] }, catalog)).toBeNull();
    expect(validateItems({ items: [{ ref: 'I1', name: 'papa', quantity: 1, unit: 'arroba' }] }, catalog)).toBeNull();
    expect(validateItems('no es json', catalog)).toBeNull();
  });

  it('suma lo repetido con la misma unidad', () => {
    const items = validateItems({ items: [
      { ref: 'I1', name: 'papa', quantity: 1, unit: 'kg' }, { ref: 'I1', name: 'papas', quantity: 2, unit: 'kg' },
    ] }, catalog);
    expect(items).toHaveLength(1);
    expect(items?.[0].quantity).toBe(3);
  });
});

describe('reglas de respaldo (sin IA)', () => {
  it('entiende cantidades, unidades y "de", con o sin números en letras', () => {
    const items = rulesParse('2 libras de papa criolla, seis huevos y media docena de limones', catalog);
    expect(items.map((i) => [i.ingredient_id, i.quantity, i.unit])).toEqual([
      ['criolla', 2, 'lb'],
      ['huevo', 6, 'unit'],
      ['limon', 6, 'unit'],
    ]);
  });

  it('lo que no está en el catálogo queda como alimento propio', () => {
    const [item] = rulesParse('1 kilo de queso campesino', catalog);
    expect(item).toMatchObject({ ingredient_id: null, name: 'Queso campesino', quantity: 1, unit: 'kg' });
  });

  it('sin cantidad, 1 unidad', () => {
    expect(rulesParse('tomates', catalog)[0]).toMatchObject({ ingredient_id: 'tomate', quantity: 1, unit: 'unit' });
  });
});

describe('buscar en el catálogo', () => {
  it.each([
    ['papas', 'papa'],
    ['papa criolla', 'criolla'],
    ['tomates', 'tomate'],
    ['limones', 'limon'],
    ['frijol', 'frijol'],
  ])('%s → %s', (name, id) => {
    expect(match(name, catalog)?.id).toBe(id);
  });

  it('no inventa coincidencias', () => {
    expect(match('chocolate', catalog)).toBeNull();
  });
});

describe('prompt', () => {
  it('lista el catálogo con referencias cortas, sin ids de la base ni datos de la persona', () => {
    const prompt = systemPrompt(catalog);
    expect(prompt).toContain('I2 Papa criolla');
    expect(prompt).not.toContain('criolla,');
    expect(prompt).not.toMatch(/alergia|dieta|correo/i);
  });
});

describe('ADR-032 · foto de la nevera o del recibo', () => {
  it('nevera: reconoce alimentos del catálogo y marca lo dudoso para revisar (F-2, F-3)', () => {
    const r = validatePhoto({
      items: [
        { ref: 'I3', name: 'huevos', quantity: 10, unit: 'unit', uncertain: false },
        { ref: 'I4', name: 'tomates', quantity: 4, unit: 'unit', uncertain: false },
        { ref: null, name: 'salsa rosada', quantity: 1, unit: 'unit', uncertain: true },
      ],
      total: 50000, problem: null,
    }, catalog, 'fridge');
    expect(r?.items.map((i) => [i.name, i.quantity, i.uncertain])).toEqual([
      ['Huevo', 10, false], ['Tomate', 4, false], ['Salsa rosada', 1, true],
    ]);
    expect(r?.total).toBeNull(); // una nevera no tiene total
    expect(r?.problem).toBeNull();
  });

  it('recibo: lee el total en pesos (F-4); un total absurdo se descarta', () => {
    expect(validatePhoto({ items: [{ ref: 'I1', name: 'papa', quantity: 2, unit: 'kg', uncertain: false }], total: 45230.4 }, catalog, 'receipt')?.total).toBe(45230);
    expect(validatePhoto({ items: [{ ref: 'I1', name: 'papa', quantity: 2, unit: 'kg', uncertain: false }], total: 5 }, catalog, 'receipt')?.total).toBeNull();
  });

  it('sin alimentos o con la foto borrosa lo dice (F-6)', () => {
    expect(validatePhoto({ items: [], problem: 'unclear' }, catalog, 'fridge')).toEqual({ items: [], total: null, problem: 'unclear' });
    expect(validatePhoto({ items: [] }, catalog, 'receipt')?.problem).toBe('no_food');
  });

  it('descarta referencias inventadas y respuestas mal formadas', () => {
    expect(validatePhoto({ items: [{ ref: 'I99', name: 'x', quantity: 1, unit: 'unit', uncertain: false }] }, catalog, 'fridge')?.problem).toBe('no_food');
    expect(validatePhoto('no es json', catalog, 'fridge')).toBeNull();
  });

  it('el prompt del recibo pide ignorar lo que no es comida y nunca devolver datos de la tienda ni de pago (F-4)', () => {
    const p = photoPrompt(catalog, 'receipt');
    expect(p).toMatch(/Ignora bolsas, aseo/);
    expect(p).toMatch(/datos de pago/);
    expect(p).toContain('I2 Papa criolla');
    expect(photoPrompt(catalog, 'fridge')).toMatch(/nevera/);
  });
});

