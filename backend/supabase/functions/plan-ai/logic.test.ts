// Pruebas de la lógica de plan-ai (ADR-039). Corren con `npm run test:functions` desde app/.
import { DEFAULT_PROFILE, type SafeIngredient } from '../_shared/recipe-ai.ts';
import {
  menuCounts,
  menuIsEnough,
  menuPrompt,
  recipesPrompt,
  requestSchema,
  schedule,
  slotsFor,
  validateMenu,
  validateRecipes,
  type Dish,
  type PlanDish,
} from './logic.ts';

const ingredients: SafeIngredient[] = [
  { ingredient_id: 'i-papa', name: 'Papa', in_pantry: true, expiring: false, is_staple: false },
  { ingredient_id: 'i-pollo', name: 'Pechuga de pollo', in_pantry: true, expiring: true, is_staple: false },
  { ingredient_id: 'i-huevo', name: 'Huevo', in_pantry: false, expiring: false, is_staple: false },
  { ingredient_id: 'i-sal', name: 'Sal', in_pantry: true, expiring: false, is_staple: true },
];
const ctx = { ingredients, profile: { ...DEFAULT_PROFILE, servings: 4, avoid: ['Cilantro'], cuisines: ['Colombiana'] } };
const restricted = { ingredients, profile: { ...DEFAULT_PROFILE, servings: 2, avoid: ['Aves', 'Maní'], restricted: true } };
const dish = (title: string, kind: Dish['kind'] = 'main', minutes = 30): Dish => ({ title, blurb: 'Rico.', kind, minutes, uses_expiring: false });

describe('cuántos platos pedir', () => {
  it('semana: 4 desayunos y 8 platos fuertes; mes: 6 y 14 (rotan); nunca más que los momentos', () => {
    expect(menuCounts(7, ['breakfast', 'lunch', 'dinner'])).toEqual({ breakfast: 4, main: 8 });
    expect(menuCounts(30, ['breakfast', 'lunch', 'dinner'])).toEqual({ breakfast: 6, main: 14 });
    expect(menuCounts(1, ['breakfast', 'lunch', 'dinner'])).toEqual({ breakfast: 1, main: 2 });
    expect(menuCounts(7, ['lunch'])).toEqual({ breakfast: 0, main: 7 });
  });
});

describe('paso 1: el menú', () => {
  it('el prompt usa el perfil, la cocina y lo que vence, y pide variedad de verdad', () => {
    const p = menuPrompt(ctx, { breakfast: 4, main: 8 }, 7);
    expect(p).toContain('Cocina para 4 personas.');
    expect(p).toContain('Cocinas que le gustan: Colombiana');
    expect(p).toContain('NO USES NUNCA, ni en los platos ni en las recetas: Cilantro');
    expect(p).toContain('Tiene en su cocina: Papa, Pechuga de pollo.');
    expect(p).toContain('Vence pronto (úsalo en los primeros platos): Pechuga de pollo.');
    expect(p).toContain('- 4 desayunos');
    expect(p).toContain('- 8 platos para almuerzo o cena');
    expect(p).toContain('varía la proteína');
  });

  it('nunca nombra alergias ni dietas (ADR-025)', () => {
    const p = menuPrompt(restricted, { breakfast: 4, main: 8 }, 7).toLowerCase();
    for (const w of ['alerg', 'vegetarian', 'dieta', 'diabet', 'kcal']) expect(p).not.toContain(w);
    expect(p).toContain('solo se pueden usar ingredientes de esta lista');
  });

  it('valida: quita repetidos, lo de "no usar", lo que pasa el tiempo y lo que sobra', () => {
    const out = validateMenu({
      dishes: [
        dish('Sudado de pollo'), dish('sudado de POLLO'), dish('Sopa de cilantro'), dish('Ajiaco', 'main', 200),
        dish('Changua', 'breakfast'), dish('Huevos pericos', 'breakfast'), dish('Arepa con queso', 'breakfast'),
      ],
    }, { ...ctx, profile: { ...ctx.profile, max_minutes: 60 } }, { breakfast: 2, main: 8 });
    expect(out.map((d) => d.title)).toEqual(['Sudado de pollo', 'Changua', 'Huevos pericos']);
  });

  it('alcanza con al menos 1 desayuno y 2 platos fuertes (si se pidieron)', () => {
    expect(menuIsEnough([dish('a', 'breakfast'), dish('b'), dish('c')], { breakfast: 4, main: 8 })).toBe(true);
    expect(menuIsEnough([dish('b'), dish('c')], { breakfast: 4, main: 8 })).toBe(false);
    expect(menuIsEnough([dish('b'), dish('c')], { breakfast: 0, main: 8 })).toBe(true);
  });
});

describe('paso 2: las recetas', () => {
  it('pide las recetas en el mismo orden, con la regla de ingredientes según haya o no restricciones', () => {
    const p = recipesPrompt(ctx, [dish('Sudado de pollo'), dish('Changua', 'breakfast')]);
    expect(p).toContain('1. «Sudado de pollo»');
    expect(p).toContain('2. «Changua»');
    expect(p).toContain('escribe su nombre común en "name"');
    expect(recipesPrompt(restricted, [dish('Sudado')])).toContain('usa SOLO los de esta lista');
  });

  it('un plato fuerte va en almuerzo y cena (los pedidos); el desayuno, en el desayuno', () => {
    expect(slotsFor('main', ['breakfast', 'lunch', 'dinner'])).toEqual(['lunch', 'dinner']);
    expect(slotsFor('main', ['breakfast', 'dinner'])).toEqual(['dinner']);
    expect(slotsFor('breakfast', ['breakfast', 'lunch'])).toEqual(['breakfast']);
  });

  it('valida cada receta con su plato; una mala no tumba las demás', () => {
    const good = {
      title: 'Sudado', servings: 4, prep_minutes: 10, cook_minutes: 30,
      ingredients: [{ ref: 'I2', grams: 600 }, { ref: 'I1', grams: 500 }], steps: ['Sofríe.', 'Agrega.', 'Cocina tapado.'],
    };
    const bad = { ...good, ingredients: [{ ref: 'I99', grams: 10 }, { ref: 'I1', grams: 10 }] };
    const out = validateRecipes({ recipes: [good, bad] }, ctx, [dish('Sudado de pollo'), dish('Otra cosa')], ['breakfast', 'lunch', 'dinner']);
    expect(out[0]).toMatchObject({ title: 'Sudado de pollo', slot: 'lunch', slots: ['lunch', 'dinner'] });
    expect(out[1]).toBeNull();
  });

  it('las acciones se validan (fechas, momentos, hasta 4 recetas por llamada)', () => {
    expect(requestSchema.safeParse({ action: 'menu', days: 30, slots: ['breakfast', 'lunch', 'dinner'] }).success).toBe(true);
    expect(requestSchema.safeParse({ action: 'menu', days: 40, slots: ['lunch'] }).success).toBe(false);
    expect(requestSchema.safeParse({ action: 'recipes', slots: ['lunch'], dishes: [1, 2, 3, 4, 5].map((n) => dish(`Plato ${n}`)) }).success).toBe(false);
  });
});

describe('paso 3: repartir en los días', () => {
  const d = (id: string, kind: PlanDish['kind'], expiring = false, coverage = 0.3): PlanDish => ({ recipe_id: id, kind, expiring, coverage });
  const week = [d('b1', 'breakfast'), d('b2', 'breakfast'), d('m1', 'main', true), d('m2', 'main'), d('m3', 'main', false, 0.8), d('m4', 'main')];

  it('llena todos los momentos, sin repetir plato el mismo día ni dos días seguidos', () => {
    const meals = schedule('2026-11-16', 7, ['breakfast', 'lunch', 'dinner'], week);
    expect(meals).toHaveLength(21);
    const byDay = new Map<string, string[]>();
    for (const m of meals) byDay.set(m.meal_date, [...(byDay.get(m.meal_date) ?? []), m.recipe_id]);
    const days = [...byDay.values()];
    for (const [i, ids] of days.entries()) {
      expect(new Set(ids).size).toBe(ids.length);
      if (i > 0) for (const id of ids) expect(days[i - 1]).not.toContain(id);
    }
  });

  it('lo que vence va primero y lo dice; lo que se tiene, "con lo de tu despensa"', () => {
    const meals = schedule('2026-11-16', 2, ['lunch', 'dinner'], week);
    expect(meals[0]).toMatchObject({ meal_date: '2026-11-16', slot: 'lunch', recipe_id: 'm1', reason_code: 'pantry_expiring' });
    expect(meals.find((m) => m.recipe_id === 'm3')?.reason_code).toBe('pantry_match');
    expect(meals.find((m) => m.recipe_id === 'm2')?.reason_code).toBe('ai_pick');
  });

  it('respeta lo ya cocinado y reparte parejo en el mes', () => {
    const meals = schedule('2026-11-16', 30, ['lunch', 'dinner'], week, new Set(['2026-11-16|lunch']));
    expect(meals).toHaveLength(59);
    expect(meals.some((m) => m.meal_date === '2026-11-16' && m.slot === 'lunch')).toBe(false);
    const counts = ['m1', 'm2', 'm3', 'm4'].map((id) => meals.filter((m) => m.recipe_id === id).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });
});
