import i18n from '@/infrastructure/i18n';
import { initialChoices, missingGroups, slotForNow, splitByPantry, toggleChoice, type FlexGroup } from '@/features/recipes/domain/recipe';
import { formatQuantity } from '@/features/recipes/ui/format-quantity';

const group = (key: number, min: number, max: number): FlexGroup => ({
  key, label: 'G', min, max,
  options: ['a', 'b', 'c'].map((id) => ({ ingredientId: id, name: id, inPantry: false, isDefault: false, selected: id === 'a' })),
});

describe('toggleChoice', () => {
  it('con máximo 1 reemplaza la opción', () => {
    const g = group(1, 1, 1);
    expect(toggleChoice(initialChoices([g]), g, 'b')).toEqual([{ groupKey: 1, ingredientId: 'b' }]);
  });

  it('con máximo 2, al llenarse sale la más antigua', () => {
    const g = group(2, 1, 2);
    let choices = toggleChoice(initialChoices([g]), g, 'b');
    expect(choices.map((c) => c.ingredientId)).toEqual(['a', 'b']);
    choices = toggleChoice(choices, g, 'c');
    expect(choices.map((c) => c.ingredientId)).toEqual(['b', 'c']);
  });

  it('quitar siempre funciona; si un grupo obligatorio queda vacío, se marca como pendiente', () => {
    const g = group(1, 1, 1);
    const choices = toggleChoice(initialChoices([g]), g, 'a');
    expect(choices).toEqual([]);
    expect(missingGroups([g], choices).map((x) => x.key)).toEqual([1]);
    expect(missingGroups([g], initialChoices([g]))).toEqual([]);
  });

  it('separa lo que hay en la cocina de lo que hay que comprar', () => {
    const g: FlexGroup = { ...group(1, 1, 1), options: [
      { ingredientId: 'cerdo', name: 'Cerdo', inPantry: true, isDefault: false, selected: true },
      { ingredientId: 'res', name: 'Res', inPantry: false, isDefault: false, selected: false },
    ] };
    const { have, buy } = splitByPantry(g.options);
    expect(have.map((o) => o.name)).toEqual(['Cerdo']);
    expect(buy.map((o) => o.name)).toEqual(['Res']);
  });

  it('en un grupo opcional sí se puede quitar todo', () => {
    const g = group(3, 0, 1);
    expect(toggleChoice(initialChoices([g]), g, 'a')).toEqual([]);
  });

  it('no toca las elecciones de otros grupos', () => {
    const g1 = group(1, 1, 1);
    const g2 = group(2, 0, 2);
    const choices = toggleChoice(initialChoices([g1, g2]), g2, 'b');
    expect(choices).toContainEqual({ groupKey: 1, ingredientId: 'a' });
  });
});

describe('slotForNow', () => {
  it.each([
    [['breakfast', 'lunch', 'dinner'], 8, 'breakfast'],
    [['breakfast', 'lunch', 'dinner'], 13, 'lunch'],
    [['breakfast', 'lunch', 'dinner'], 20, 'dinner'],
    [['lunch', 'dinner'], 8, 'lunch'],
    [['breakfast', 'snack'], 20, 'breakfast'],
  ] as const)('%j a las %i h → %s', (slots, hour, expected) => {
    expect(slotForNow([...slots], hour)).toBe(expected);
  });
});

describe('formatQuantity', () => {
  const t = i18n.t.bind(i18n);
  it.each([
    [300, 'g', '300 g'],
    [1500, 'g', '1,5 kg'],
    [1500, 'ml', '1,5 L'],
    [1, 'unit', '1 unidad'],
    [2.5, 'unit', '2,5 unidades'],
    [0.5, 'tsp', '0,5 cucharaditas'],
    [3, 'clove', '3 dientes'],
  ] as const)('%d %s → %s', (q, unit, text) => {
    expect(formatQuantity(q, unit, t)).toBe(text);
  });
});
