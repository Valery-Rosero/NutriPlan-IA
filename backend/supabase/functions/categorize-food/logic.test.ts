// Pruebas de la lógica de categorize-food (B3, ADR-027). Corren con `npm run test:functions` desde app/.
import { displayName, normalizeFoodText, responseSchema, rulesLabel, validateLabel } from './logic.ts';

const GROUPS = ['red_meat', 'poultry', 'fish', 'shellfish', 'dairy', 'egg', 'honey', 'legumes', 'grains', 'vegetables', 'fruits', 'nuts_seeds', 'fats_oils', 'herbs_spices', 'tubers', 'other'];
const CATEGORIES = ['produce', 'meat_fish', 'dairy_eggs', 'bakery', 'pantry', 'frozen', 'spices_condiments', 'other'];

describe('categorize-food: normalizar', () => {
  it('minúsculas, sin tildes ni signos, espacios simples', () => {
    expect(normalizeFoodText('  Queso   Campesino! ')).toBe('queso campesino');
    expect(normalizeFoodText('Piña, Ñame y LIMÓN')).toBe('pina name y limon');
    expect(normalizeFoodText('!!!')).toBe('');
  });

  it('no pasa de 80 caracteres y no termina en espacio', () => {
    const key = normalizeFoodText(`${'a'.repeat(79)} bbbbbb`);
    expect(key.length).toBeLessThanOrEqual(80);
    expect(key.endsWith(' ')).toBe(false);
  });

  it('el nombre para mostrar es el que escribió la persona, limpio', () => {
    expect(displayName('  queso   campesino ')).toBe('Queso campesino');
    expect(displayName('pan\u0000 tajado')).toBe('Pan tajado');
  });
});

describe('categorize-food: reglas de respaldo', () => {
  it('ubica alimentos comunes en su grupo y sección', () => {
    expect(rulesLabel('pechuga de pollo')).toMatchObject({ isFood: true, foodGroup: 'poultry', storeCategory: 'meat_fish' });
    expect(rulesLabel('queso campesino')).toMatchObject({ foodGroup: 'dairy', storeCategory: 'dairy_eggs' });
    expect(rulesLabel('tomates')).toMatchObject({ foodGroup: 'vegetables', storeCategory: 'produce' }); // plural
    expect(rulesLabel('limones')).toMatchObject({ foodGroup: 'fruits' });
    expect(rulesLabel('helado de mora')).toMatchObject({ foodGroup: 'dairy', storeCategory: 'frozen' });
  });

  it('las frases de varias palabras ganan a las sueltas', () => {
    expect(rulesLabel('tomate de arbol')).toMatchObject({ foodGroup: 'fruits' });
    expect(rulesLabel('salsa de tomate')).toMatchObject({ foodGroup: 'herbs_spices' });
    expect(rulesLabel('crema de leche')).toMatchObject({ foodGroup: 'dairy' });
  });

  it('lo que no es comida va sin grupo, a "Otros"', () => {
    expect(rulesLabel('bolsas de basura')).toEqual(expect.objectContaining({ isFood: false, foodGroup: null, storeCategory: 'other' }));
    expect(rulesLabel('papel higienico')).toMatchObject({ isFood: false });
    expect(rulesLabel('jabon de loza')).toMatchObject({ isFood: false });
  });

  it('no confunde palabras parecidas: "panela" no es "pan", "pasta dental" no es pasta', () => {
    expect(rulesLabel('panela')).toMatchObject({ foodGroup: 'other', storeCategory: 'pantry' });
    expect(rulesLabel('pasta dental')).toMatchObject({ isFood: false });
  });

  it('si nada coincide: comida, grupo y sección "Otros"', () => {
    expect(rulesLabel('xyz raro')).toEqual({ isFood: true, foodGroup: 'other', storeCategory: 'other', mealSlot: null, kcalPerServing: null, proteinPerServing: null });
  });

  it('todas las reglas usan códigos que existen en la base', () => {
    for (const key of ['pollo', 'carne', 'atun', 'camaron', 'leche', 'huevo', 'miel', 'frijol', 'pan', 'arroz', 'papa', 'mango', 'tomate', 'mani', 'aceite', 'sal', 'azucar', 'helado', 'arveja']) {
      const label = rulesLabel(key);
      expect(CATEGORIES).toContain(label.storeCategory);
      if (label.foodGroup) expect(GROUPS).toContain(label.foodGroup);
    }
  });
});

describe('categorize-food: validar lo que responde la IA', () => {
  it('acepta una respuesta con códigos de la base y redondea', () => {
    expect(validateLabel({ is_food: true, food_group: 'grains', store_category: 'bakery', meal_slot: 'snack', kcal_per_serving: 250.04, protein_g_per_serving: 6 }, GROUPS, CATEGORIES))
      .toEqual({ isFood: true, foodGroup: 'grains', storeCategory: 'bakery', mealSlot: 'snack', kcalPerServing: 250, proteinPerServing: 6 });
  });

  it('rechaza códigos inventados o respuestas incompletas', () => {
    expect(validateLabel({ is_food: true, food_group: 'snacks', store_category: 'bakery' }, GROUPS, CATEGORIES)).toBeNull();
    expect(validateLabel({ is_food: true, food_group: 'grains', store_category: 'aisle_9' }, GROUPS, CATEGORIES)).toBeNull();
    expect(validateLabel({ food_group: 'grains', store_category: 'bakery' }, GROUPS, CATEGORIES)).toBeNull();
    expect(validateLabel('texto libre', GROUPS, CATEGORIES)).toBeNull();
    expect(validateLabel(null, GROUPS, CATEGORIES)).toBeNull();
  });

  it('si no es comida, quita grupo y nutrición aunque el modelo los mande', () => {
    expect(validateLabel({ is_food: false, food_group: 'other', store_category: 'other', kcal_per_serving: 10, meal_slot: 'lunch' }, GROUPS, CATEGORIES))
      .toEqual({ isFood: false, foodGroup: null, storeCategory: 'other', mealSlot: null, kcalPerServing: null, proteinPerServing: null });
  });

  it('descarta números imposibles y proteína incoherente con las calorías', () => {
    const v = validateLabel({ is_food: true, food_group: 'grains', store_category: 'bakery', meal_slot: 'brunch', kcal_per_serving: -5, protein_g_per_serving: 999 }, GROUPS, CATEGORIES);
    expect(v).toMatchObject({ mealSlot: null, kcalPerServing: null, proteinPerServing: null });
    const w = validateLabel({ is_food: true, food_group: 'poultry', store_category: 'meat_fish', kcal_per_serving: 100, protein_g_per_serving: 60 }, GROUPS, CATEGORIES);
    expect(w).toMatchObject({ kcalPerServing: 100, proteinPerServing: null }); // 60 g × 4 = 240 kcal > 100
  });

  it('el esquema solo deja escoger códigos de las listas', () => {
    const schema = responseSchema(GROUPS.map((code) => ({ code, name: code })), CATEGORIES.map((code) => ({ code, name: code }))) as {
      properties: Record<string, { enum?: string[] }>;
    };
    expect(schema.properties.food_group.enum).toEqual(GROUPS);
    expect(schema.properties.store_category.enum).toEqual(CATEGORIES);
  });
});
