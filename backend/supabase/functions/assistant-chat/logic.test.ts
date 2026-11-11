// Pruebas de la lógica del asistente (ADR-003, ADR-025). Corren con `npm run test:functions` desde app/.
import { fallbackDecision, slotForNow, systemPrompt, validateAnswer, type Candidate } from './logic.ts';

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

describe('validar lo que propone el modelo', () => {
  it('acepta una receta de la lista de candidatas', () => {
    expect(validateAnswer({ reply: 'Te va el sudado.', recipe_id: 'r-sudado', pantry_only: false }, candidates))
      .toEqual({ reply: 'Te va el sudado.', recipeId: 'r-sudado', fallback: false });
  });

  it('rechaza un id inventado (no se confía en esa respuesta: se usa el respaldo)', () => {
    expect(validateAnswer({ reply: 'Haz este.', recipe_id: 'r-inventada', pantry_only: false }, candidates)).toBeNull();
  });

  it('rechaza respuestas con forma inválida', () => {
    expect(validateAnswer({ texto: 'hola' }, candidates)).toBeNull();
    expect(validateAnswer({ reply: '', pantry_only: false }, candidates)).toBeNull();
    expect(validateAnswer('no es json', candidates)).toBeNull();
  });

  it('permite responder sin receta (p. ej. una pregunta de salud)', () => {
    expect(validateAnswer({ reply: 'Eso consúltalo con un profesional.', recipe_id: null, pantry_only: false }, candidates))
      .toEqual({ reply: 'Eso consúltalo con un profesional.', recipeId: null, fallback: false });
  });

  it('US-160: "solo con lo que tengo" no admite recetas con faltantes y dice qué falta', () => {
    const onlyMissing = [lentejas, pasta];
    const decision = validateAnswer({ reply: 'Haz la pasta.', recipe_id: 'r-pasta', pantry_only: true }, onlyMissing);
    expect(decision?.recipeId).toBeNull();
    expect(decision?.reply).toBe('No tengo una receta completa solo con tu cocina: para "Pasta con lo que hay en la nevera" te falta Pasta seca.');
  });

  it('US-160: con una receta completa en la cocina, sí la acepta', () => {
    expect(validateAnswer({ reply: 'El sudado.', recipe_id: 'r-sudado', pantry_only: true }, candidates)?.recipeId).toBe('r-sudado');
  });
});

describe('respaldo sin modelo', () => {
  it('elige la candidata con más de la despensa', () => {
    const d = fallbackDecision(candidates, null);
    expect(d).toMatchObject({ recipeId: 'r-sudado', fallback: true });
    expect(d.reply).toContain('tienes todo lo necesario');
  });

  it('al cambiar una comida no propone la misma', () => {
    const target = { planned_meal_id: 'm1', slot: 'lunch', current_title: 'Sudado de lo que haya' };
    expect(fallbackDecision(candidates, target).recipeId).toBe('r-pasta');
  });

  it('sin candidatas lo dice en vez de inventar', () => {
    expect(fallbackDecision([], null)).toMatchObject({ recipeId: null, fallback: true });
  });
});

describe('prompt (ADR-025: minimización de datos)', () => {
  const prompt = systemPrompt('dinner', candidates, null);

  it('lista solo las candidatas, con su id exacto y lo que falta', () => {
    expect(prompt).toContain('id=r-lentejas');
    expect(prompt).toContain('le falta: Lentejas secas, Zanahoria');
    expect(prompt).toContain('Momento del día: cena.');
  });

  it('no lleva alergias, dietas ni datos de salud', () => {
    expect(prompt).not.toMatch(/alergia|alérgen|dieta|vegan|celíac|diabet/i);
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
