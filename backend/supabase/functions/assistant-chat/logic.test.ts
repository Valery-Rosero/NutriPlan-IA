// Pruebas de la lógica del asistente (ADR-003, ADR-025, ADR-029, ADR-037). Corren con `npm run test:functions` desde app/.
import {
  DEFAULT_PROFILE,
  fallbackDecision,
  fillPrompt,
  ideasPrompt,
  mentionsAvoided,
  newRecipeSummary,
  slotForNow,
  validateFill,
  validateIdeas,
  weekSummary,
  type AssistantProfile,
  type Candidate,
  type Context,
  type Idea,
  type SafeIngredient,
} from './logic.ts';

const sudado: Candidate = {
  recipe_id: 'r-sudado', title: 'Sudado de lo que haya', total_minutes: 40, coverage: 1, missing: [], uses_expiring: false,
};
const lentejas: Candidate = {
  recipe_id: 'r-lentejas', title: 'Lentejas guisadas con lo que haya', total_minutes: 50, coverage: 0.6,
  missing: [{ ingredient_name: 'Lentejas secas' }, { ingredient_name: 'Zanahoria' }], uses_expiring: true,
};
const pasta: Candidate = {
  recipe_id: 'r-pasta', title: 'Pasta con lo que hay en la nevera', total_minutes: 30, coverage: 0.8,
  missing: [{ ingredient_name: 'Pasta seca' }], uses_expiring: false,
};
const candidates = [lentejas, pasta, sudado];

const ingredients: SafeIngredient[] = [ // I1, I2, I3, I4
  { ingredient_id: 'i-papa', name: 'Papa', in_pantry: true, expiring: true, is_staple: false },
  { ingredient_id: 'i-pollo', name: 'Pechuga de pollo', in_pantry: false, expiring: false, is_staple: false },
  { ingredient_id: 'i-cebolla', name: 'Cebolla cabezona', in_pantry: true, expiring: false, is_staple: false },
  { ingredient_id: 'i-sal', name: 'Sal', in_pantry: true, expiring: false, is_staple: true },
];

const free: AssistantProfile = { ...DEFAULT_PROFILE, servings: 4, cuisines: ['Colombiana'], avoid: ['Cilantro'] };
const restricted: AssistantProfile = {
  ...DEFAULT_PROFILE, servings: 2, max_minutes: 45, spice: 1, budget: 'tight',
  avoid: ['Aves', 'Carnes rojas', 'Cilantro', 'Maní', 'Mariscos', 'Pescados'], restricted: true,
};
const ctx: Context = { slot: 'lunch', candidates, ingredients, target: null, profile: free };

const idea = (title: string, minutes = 30, blurb = 'Rico y rendidor.') => ({ title, blurb, minutes });
const IDEA: Idea = { title: 'Sudado de pollo con papa', blurb: 'Jugoso, de una sola olla.', minutes: 40, recipe_id: null };
const receta = (ingredientsRaw: unknown[], extra: Record<string, unknown> = {}) => ({
  title: 'Sudado', description: 'De una olla.', servings: 4, prep_minutes: 10, cook_minutes: 30,
  ingredients: ingredientsRaw, steps: ['Sofríe la cebolla.', 'Agrega el pollo y la papa.', 'Cocina tapado.'], ...extra,
});

describe('paso 1: la lista de platos (ADR-037)', () => {
  it('acepta entre 2 y 5 ideas con nombre, frase y minutos, y una frase que las presenta', () => {
    const d = validateIdeas({
      reply: 'Con lo que tienes, mira:',
      ideas: [idea('Sudado de pollo'), idea('Arroz atollado', 45), idea('Tortilla de papa', 20), idea('Lentejas con maduro', 35), idea('Ajiaco', 50)],
    }, ctx);
    expect(d?.ideas).toHaveLength(5);
    expect(d?.ideas[0]).toEqual({ title: 'Sudado de pollo', blurb: 'Rico y rendidor.', minutes: 30, recipe_id: null });
    expect(d?.reply).toBe('Con lo que tienes, mira:');
  });

  it('nunca pasa de 5, y quita repetidos, los que pasan su tiempo máximo y los que llevan algo de "no usar"', () => {
    const d = validateIdeas({
      reply: 'Ideas:',
      ideas: [
        idea('Arroz con pollo'), idea('arroz con POLLO'), idea('Sopa de cilantro'), idea('Ajiaco', 120),
        idea('Tortilla de papa', 20), idea('Huevos pericos', 15),
      ],
    }, { ...ctx, profile: { ...free, max_minutes: 60 } });
    expect(d?.ideas.map((i) => i.title)).toEqual(['Arroz con pollo', 'Tortilla de papa', 'Huevos pericos']);
  });

  it('con menos de 2 ideas válidas usa el respaldo (null)', () => {
    expect(validateIdeas({ reply: 'x', ideas: [idea('Ensalada de cilantro')] }, ctx)).toBeNull();
    expect(validateIdeas({ nada: true }, ctx)).toBeNull();
  });

  it('sin ideas pero con respuesta (p. ej. una pregunta de salud) responde igual', () => {
    expect(validateIdeas({ reply: 'Eso consúltalo con un profesional.', ideas: [] }, ctx)).toEqual({
      reply: 'Eso consúltalo con un profesional.', ideas: [], fallback: false,
    });
  });

  it('al cambiar una comida no vuelve a proponer la misma', () => {
    const swap = { ...ctx, target: { planned_meal_id: 'm1', slot: 'lunch', current_title: 'Lentejas guisadas' } };
    const d = validateIdeas({ reply: 'Mira:', ideas: [idea('Lentejas guisadas'), idea('Arroz atollado'), idea('Tortilla')] }, swap);
    expect(d?.ideas.map((i) => i.title)).toEqual(['Arroz atollado', 'Tortilla']);
  });

  it('quita los ** que a veces pone el modelo en los nombres', () => {
    const d = validateIdeas({ reply: 'x', ideas: [idea('**Arroz atollado**'), idea('Sudado')] }, ctx);
    expect(d?.ideas[0].title).toBe('Arroz atollado');
  });
});

describe('lo que la IA sabe de la persona (ADR-037)', () => {
  it('usa porciones, tiempo, picante, presupuesto, cocinas y "no usar"', () => {
    const p = ideasPrompt({ ...ctx, profile: restricted });
    expect(p).toContain('Cocina para 2 personas.');
    expect(p).toContain('Tiempo máximo por receta: 45 minutos');
    expect(p).toContain('Picante: picante suave.');
    expect(p).toContain('Presupuesto ajustado');
    expect(p).toContain('NO USES NUNCA, ni en los platos ni en las recetas: Aves, Carnes rojas, Cilantro, Maní, Mariscos, Pescados.');
    expect(ideasPrompt(ctx)).toContain('Cocinas que le gustan: Colombiana');
  });

  it('nunca nombra alergias, dietas ni datos de salud (ADR-025)', () => {
    const p = `${ideasPrompt({ ...ctx, profile: restricted })}\n${fillPrompt({ ...ctx, profile: restricted }, IDEA)}`.toLowerCase();
    for (const word of ['alerg', 'vegetarian', 'vegan', 'dieta', 'celiac', 'diabet', 'kcal', 'calor']) expect(p).not.toContain(word);
    expect(p).toContain('no expliques por qué');
  });

  it('con alergias o dietas, solo la lista; sin ellas, cualquier ingrediente común', () => {
    expect(ideasPrompt({ ...ctx, profile: restricted })).toContain('solo puedes usar los de esta lista');
    expect(ideasPrompt(ctx)).toContain('puedes usar cualquier ingrediente común en Colombia');
    expect(fillPrompt(ctx, IDEA)).toContain('escribe su nombre común en "name"');
  });

  it('pide platos distintos y de verdad (no solo ensalada y batido), y respuesta corta', () => {
    const p = ideasPrompt(ctx);
    expect(p).toContain('DISTINTOS entre sí');
    expect(p).toContain('ensaladas o batidos solo si los pide');
    expect(p).toContain('UNA frase corta');
  });

  it('reconoce lo de "no usar" aunque cambie el plural o las tildes', () => {
    expect(mentionsAvoided('Arroz con maní tostado', ['Maní'])).toBe(true);
    expect(mentionsAvoided('Ceviche de camarones', ['Camarón'])).toBe(true);
    expect(mentionsAvoided('Tortilla de papa', ['Maní', 'Cilantro'])).toBe(false);
    expect(mentionsAvoided('Ensalada de aguacate', ['Aves'])).toBe(false); // "aves" ≠ "aguacate"
  });
});

describe('paso 2: llenar la receta del plato elegido', () => {
  it('traduce las referencias I… y deja lo libre por nombre (sin restricciones)', () => {
    const r = validateFill(receta([
      { ref: 'I2', grams: 600 }, { ref: 'I1', grams: 500 }, { name: 'Chontaduro', grams: 120 },
    ]), ctx, IDEA);
    expect(r?.ingredients).toEqual([
      { ingredient_id: 'i-pollo', grams: 600 }, { ingredient_id: 'i-papa', grams: 500 }, { name: 'Chontaduro', grams: 120 },
    ]);
    expect(r?.title).toBe('Sudado de pollo con papa'); // el nombre de la idea que eligió
    expect(r?.slot).toBe('lunch');
    expect(r?.servings).toBe(4);
  });

  it('un nombre que está en la lista cuenta como ese ingrediente', () => {
    const r = validateFill(receta([{ name: 'papa', grams: 500 }, { ref: 'I3', grams: 100 }]), ctx, IDEA);
    expect(r?.ingredients[0]).toEqual({ ingredient_id: 'i-papa', grams: 500 });
  });

  it('con restricciones, nada fuera de la lista: la receta se descarta', () => {
    expect(validateFill(receta([{ ref: 'I1', grams: 500 }, { name: 'Chontaduro', grams: 100 }]), { ...ctx, profile: restricted }, IDEA)).toBeNull();
  });

  it('descarta referencias inventadas, repetidos, lo de "no usar" y lo que pasa el tiempo máximo', () => {
    expect(validateFill(receta([{ ref: 'I1', grams: 500 }, { ref: 'I99', grams: 1 }]), ctx, IDEA)).toBeNull();
    expect(validateFill(receta([{ ref: 'I1', grams: 500 }, { ref: 'I1', grams: 200 }]), ctx, IDEA)).toBeNull();
    expect(validateFill(receta([{ ref: 'I1', grams: 500 }, { name: 'Cilantro', grams: 10 }]), ctx, IDEA)).toBeNull();
    expect(validateFill(receta([{ ref: 'I1', grams: 500 }, { ref: 'I3', grams: 100 }], { cook_minutes: 60 }),
      { ...ctx, profile: { ...free, max_minutes: 45 } }, IDEA)).toBeNull();
  });

  it('necesita al menos un ingrediente de la lista y pasos de verdad', () => {
    expect(validateFill(receta([{ name: 'Chontaduro', grams: 100 }, { name: 'Panela', grams: 50 }]), ctx, IDEA)).toBeNull();
    expect(validateFill(receta([{ ref: 'I1', grams: 500 }, { ref: 'I3', grams: 100 }], { steps: ['Ok'] }), ctx, IDEA)).toBeNull();
  });

  it('el prompt de la receta lleva el plato, las porciones y la lista con referencias', () => {
    const p = fillPrompt(ctx, IDEA);
    expect(p).toContain('«Sudado de pollo con papa»');
    expect(p).toContain('para 4 porciones');
    expect(p).toContain('I1 Papa (en su cocina, vence pronto)');
  });
});

describe('tarjeta de una receta nueva', () => {
  it('cuenta lo que hay en la cocina; lo libre y lo que no está se compra', () => {
    const r = validateFill(receta([{ ref: 'I1', grams: 500 }, { ref: 'I2', grams: 600 }, { name: 'Chontaduro', grams: 120 }]), ctx, IDEA)!;
    expect(newRecipeSummary(r, ingredients)).toMatchObject({ totalMinutes: 40, coverage: 0.33, missing: ['Pechuga de pollo', 'Chontaduro'] });
  });
});

describe('respaldo sin IA: ideas del recetario', () => {
  it('las que más tiene en la cocina primero, con lo que falta', () => {
    const d = fallbackDecision(candidates, null);
    expect(d.fallback).toBe(true);
    expect(d.ideas.map((i) => i.recipe_id)).toEqual(['r-sudado', 'r-pasta', 'r-lentejas']);
    expect(d.ideas[2].blurb).toBe('Te falta Lentejas secas, Zanahoria.');
  });

  it('al cambiar una comida no propone la misma', () => {
    const d = fallbackDecision(candidates, { planned_meal_id: 'm', slot: 'lunch', current_title: 'Sudado de lo que haya' });
    expect(d.ideas.map((i) => i.recipe_id)).not.toContain('r-sudado');
  });

  it('sin candidatas lo dice en vez de inventar', () => {
    expect(fallbackDecision([], null)).toMatchObject({ ideas: [], fallback: true });
  });
});

describe('US-174 · cambios a toda la semana', () => {
  const withPlan: Context = { ...ctx, hasPlan: true };

  it('traduce la frase a meta + ingredientes a evitar (referencias I…), sin ideas', () => {
    const d = validateIdeas({
      reply: '¡Claro! Busco cómo abaratar tu semana.',
      ideas: [idea('Arroz'), idea('Sopa')],
      week: { goal: 'cheaper', avoid: ['I2', 'I99'] },
    }, withPlan);
    expect(d).toEqual({
      reply: '¡Claro! Busco cómo abaratar tu semana.',
      ideas: [],
      fallback: false,
      week: { goal: 'cheaper', avoid: [{ id: 'i-pollo', name: 'Pechuga de pollo' }] }, // I99 no existe: se ignora
    });
  });

  it('solo evitar algo, sin meta, también sirve', () => {
    const d = validateIdeas({ reply: 'Listo.', ideas: [], week: { goal: null, avoid: ['I1'] } }, withPlan);
    expect(d?.week).toEqual({ goal: null, avoid: [{ id: 'i-papa', name: 'Papa' }] });
  });

  it('sin plan, o cambiando una sola comida, se ignora el modo semana', () => {
    const raw = { reply: 'Mira', ideas: [idea('Arroz'), idea('Sopa')], week: { goal: 'cheaper', avoid: [] } };
    expect(validateIdeas(raw, { ...ctx, hasPlan: false })?.week).toBeUndefined();
    const swap = { ...withPlan, target: { planned_meal_id: 'm1', slot: 'lunch', current_title: 'Lentejas' } };
    expect(validateIdeas(raw, swap)?.week).toBeUndefined();
  });

  it('una meta inventada invalida la respuesta (respaldo)', () => {
    expect(validateIdeas({ reply: 'x', ideas: [], week: { goal: 'magia', avoid: [] } }, withPlan)).toBeNull();
  });

  it('el prompt explica el modo semana solo si hay plan', () => {
    expect(ideasPrompt(withPlan)).toContain('"week"');
    expect(ideasPrompt({ ...ctx, hasPlan: false })).toContain('primero organice su semana');
  });

  it('el resumen pone las cifras de la base: cambios, ahorro y lo que no se pudo', () => {
    expect(weekSummary([
      { new_recipe_id: 'a', saving: '5121', reason: 'cheaper' },
      { new_recipe_id: 'b', saving: 3902, reason: 'avoid' },
      { new_recipe_id: 'c', saving: null, reason: 'avoid' },
      { new_recipe_id: null, saving: null, reason: 'avoid_unresolved' },
    ])).toEqual({
      text: '**3 cambios** en tu semana · ahorras **$9.023**. Revísalos antes de aplicar.\n\nPara 1 comida no encontré una receta segura sin lo que pediste evitar.',
      changes: 3,
      saving: 9023,
      unresolved: 1,
    });
  });

  it('S-6: sin nada que mejorar, lo dice claro', () => {
    const s = weekSummary([]);
    expect(s.changes).toBe(0);
    expect(s.text).toMatch(/No encontré cambios/);
  });
});

describe('momento del día en Colombia (UTC−5)', () => {
  it.each([
    ['2026-11-10T12:00:00Z', 'breakfast'], // 7:00 en Pasto
    ['2026-11-10T18:00:00Z', 'lunch'], // 13:00
    ['2026-11-10T21:30:00Z', 'snack'], // 16:30
    ['2026-11-11T01:00:00Z', 'dinner'], // 20:00
  ])('%s → %s', (iso, slot) => {
    expect(slotForNow(new Date(iso))).toBe(slot);
  });
});
