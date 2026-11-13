// Pruebas de la lógica del asistente (ADR-003, ADR-025, ADR-029). Corren con `npm run test:functions` desde app/.
import {
  fallbackDecision,
  newRecipeSummary,
  slotForNow,
  systemPrompt,
  validateAnswer,
  type Candidate,
  type Context,
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
const candidates = [lentejas, pasta, sudado]; // R1, R2, R3

const ingredients: SafeIngredient[] = [ // I1, I2, I3, I4
  { ingredient_id: 'i-papa', name: 'Papa', in_pantry: true, expiring: true, is_staple: false },
  { ingredient_id: 'i-pollo', name: 'Pechuga de pollo', in_pantry: false, expiring: false, is_staple: false },
  { ingredient_id: 'i-cebolla', name: 'Cebolla cabezona', in_pantry: true, expiring: false, is_staple: false },
  { ingredient_id: 'i-sal', name: 'Sal', in_pantry: true, expiring: false, is_staple: true },
];

const ctx: Context = { slot: 'lunch', candidates, ingredients, target: null, servings: 4 };

const nueva = (extra: Record<string, unknown> = {}) => ({
  title: 'Pollo salteado con papa',
  description: 'Rápido y rendidor.',
  prep_minutes: 10,
  cook_minutes: 20,
  ingredients: [{ ref: 'I1', grams: 400 }, { ref: 'I2', grams: 300 }, { ref: 'I3', grams: 80 }],
  steps: ['Pela y corta la papa.', 'Saltea el pollo con la cebolla.', 'Junta todo y sirve.'],
  ...extra,
});

describe('validar lo que propone el modelo', () => {
  it('acepta varias opciones: del recetario (por su referencia R…) y nuevas (con ingredientes I…)', () => {
    const d = validateAnswer({
      reply: '¡Claro! Te tengo tres ideas 🍲',
      pantry_only: false,
      options: [{ kind: 'catalog', ref: 'R3' }, { kind: 'new', recipe: nueva() }, { kind: 'catalog', ref: 'R2' }],
    }, ctx);
    expect(d?.fallback).toBe(false);
    expect(d?.picks).toEqual([
      { kind: 'catalog', recipeId: 'r-sudado' },
      {
        kind: 'new',
        recipe: {
          title: 'Pollo salteado con papa', description: 'Rápido y rendidor.', slot: 'lunch', servings: 4,
          prep_minutes: 10, cook_minutes: 20,
          ingredients: [{ ingredient_id: 'i-papa', grams: 400 }, { ingredient_id: 'i-pollo', grams: 300 }, { ingredient_id: 'i-cebolla', grams: 80 }],
          steps: ['Pela y corta la papa.', 'Saltea el pollo con la cebolla.', 'Junta todo y sirve.'],
        },
      },
      { kind: 'catalog', recipeId: 'r-pasta' },
    ]);
  });

  it('nunca pasa de tres opciones ni repite una receta', () => {
    const d = validateAnswer({
      reply: 'Mira',
      pantry_only: false,
      options: [{ kind: 'catalog', ref: 'R1' }, { kind: 'catalog', ref: 'R1' }, { kind: 'catalog', ref: 'R2' }, { kind: 'catalog', ref: 'R3' }],
    }, ctx);
    expect(d?.picks.map((p) => (p.kind === 'catalog' ? p.recipeId : 'new'))).toEqual(['r-lentejas', 'r-pasta']);
  });

  it('descarta una receta nueva con un ingrediente fuera de la lista permitida (toda la receta)', () => {
    const d = validateAnswer({
      reply: 'Mira',
      pantry_only: false,
      options: [{ kind: 'new', recipe: nueva({ ingredients: [{ ref: 'I1', grams: 300 }, { ref: 'I99', grams: 50 }] }) }, { kind: 'catalog', ref: 'R3' }],
    }, ctx);
    expect(d?.picks).toEqual([{ kind: 'catalog', recipeId: 'r-sudado' }]);
  });

  it('descarta recetas nuevas mal formadas (sin pasos, ingrediente repetido, cantidades absurdas)', () => {
    for (const bad of [nueva({ steps: [] }), nueva({ ingredients: [{ ref: 'I1', grams: 100 }, { ref: 'I1', grams: 50 }] }),
      nueva({ ingredients: [{ ref: 'I1', grams: 99999 }] }), nueva({ title: 'X' })]) {
      expect(validateAnswer({ reply: 'Mira', pantry_only: false, options: [{ kind: 'new', recipe: bad }] }, ctx)).toBeNull();
    }
  });

  it('rechaza referencias inventadas (sin nada válido se usa el respaldo)', () => {
    expect(validateAnswer({ reply: 'Haz este.', pantry_only: false, options: [{ kind: 'catalog', ref: 'R9' }] }, ctx)).toBeNull();
    expect(validateAnswer({ reply: 'Haz este.', pantry_only: false, options: [{ kind: 'catalog', ref: 'r-sudado' }] }, ctx)).toBeNull();
  });

  it('rechaza respuestas con forma inválida', () => {
    expect(validateAnswer({ texto: 'hola' }, ctx)).toBeNull();
    expect(validateAnswer({ reply: '', pantry_only: false, options: [] }, ctx)).toBeNull();
    expect(validateAnswer('no es json', ctx)).toBeNull();
  });

  it('permite responder sin opciones (p. ej. una pregunta de salud)', () => {
    expect(validateAnswer({ reply: 'Eso consúltalo con un profesional.', pantry_only: false, options: [] }, ctx))
      .toEqual({ reply: 'Eso consúltalo con un profesional.', picks: [], fallback: false });
  });

  it('al cambiar una comida no vuelve a proponer la misma, y la receta nueva queda en ese momento del día', () => {
    const swap: Context = { ...ctx, slot: 'lunch', target: { planned_meal_id: 'm1', slot: 'dinner', current_title: 'Sudado de lo que haya' } };
    const d = validateAnswer({ reply: 'Mira', pantry_only: false, options: [{ kind: 'catalog', ref: 'R3' }, { kind: 'new', recipe: nueva() }] }, swap);
    expect(d?.picks).toHaveLength(1);
    expect(d?.picks[0]).toMatchObject({ kind: 'new', recipe: { slot: 'dinner' } });
  });

  it('US-160: "solo con lo que tengo" no admite faltantes (recetario ni nuevas) y dice qué falta', () => {
    const d = validateAnswer({
      reply: 'Haz la pasta.',
      pantry_only: true,
      options: [{ kind: 'catalog', ref: 'R2' }, { kind: 'new', recipe: nueva() }], // la nueva lleva pollo, que hay que comprar
    }, { ...ctx, candidates: [lentejas, pasta] });
    expect(d?.picks).toEqual([]);
    expect(d?.reply).toBe('No tengo una receta completa solo con tu cocina: para **Pasta con lo que hay en la nevera** te falta Pasta seca. ¿Te la propongo igual?');
  });

  it('US-160: con lo que hay sí acepta (recetario completo o receta nueva solo con la cocina y básicos)', () => {
    const soloCocina = nueva({ ingredients: [{ ref: 'I1', grams: 500 }, { ref: 'I3', grams: 80 }, { ref: 'I4', grams: 5 }] });
    const d = validateAnswer({ reply: 'Mira', pantry_only: true, options: [{ kind: 'catalog', ref: 'R3' }, { kind: 'new', recipe: soloCocina }] }, ctx);
    expect(d?.picks).toHaveLength(2);
  });
});

describe('tarjeta de una receta nueva', () => {
  it('cuenta lo que hay en la cocina y nombra lo que falta comprar', () => {
    const d = validateAnswer({ reply: 'Mira', pantry_only: false, options: [{ kind: 'new', recipe: nueva() }] }, ctx)!;
    const pick = d.picks[0];
    if (pick.kind !== 'new') throw new Error('esperaba una receta nueva');
    expect(newRecipeSummary(pick.recipe, ingredients)).toEqual({ totalMinutes: 30, coverage: 0.67, missing: ['Pechuga de pollo'] });
  });
});

describe('respaldo sin modelo', () => {
  it('elige la candidata con más de la despensa', () => {
    const d = fallbackDecision(candidates, null);
    expect(d).toMatchObject({ picks: [{ kind: 'catalog', recipeId: 'r-sudado' }], fallback: true });
    expect(d.reply).toContain('tienes todo lo necesario');
  });

  it('al cambiar una comida no propone la misma', () => {
    const target = { planned_meal_id: 'm1', slot: 'lunch', current_title: 'Sudado de lo que haya' };
    expect(fallbackDecision(candidates, target).picks).toEqual([{ kind: 'catalog', recipeId: 'r-pasta' }]);
  });

  it('sin candidatas lo dice en vez de inventar', () => {
    expect(fallbackDecision([], null)).toMatchObject({ picks: [], fallback: true });
  });
});

describe('prompt (ADR-025: minimización de datos)', () => {
  const prompt = systemPrompt({ ...ctx, slot: 'dinner' });

  it('lista el recetario con referencias cortas y lo que falta', () => {
    expect(prompt).toContain('R1 | Lentejas guisadas con lo que haya');
    expect(prompt).toContain('le falta: Lentejas secas, Zanahoria');
    expect(prompt).toContain('Momento del día: cena. Porciones por defecto: 4.');
  });

  it('lista los ingredientes permitidos, qué hay en la cocina y qué vence', () => {
    expect(prompt).toContain('I1 Papa (en su cocina, vence pronto)');
    expect(prompt).toContain('I2 Pechuga de pollo (hay que comprarlo)');
    expect(prompt).toContain('I4 Sal (básico de cocina)');
  });

  it('no lleva ids de la base, alergias, dietas ni datos de salud', () => {
    expect(prompt).not.toContain('r-sudado');
    expect(prompt).not.toContain('i-papa');
    expect(prompt).not.toMatch(/alergia|alérgen|dieta|vegan|celíac|diabet/i);
  });

  it('pide responder bonito y sin palabras con género', () => {
    expect(prompt).toMatch(/Markdown/);
    expect(prompt).toMatch(/nada de "mijo"/);
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
