import { errorCode, errorKey } from '@/lib/errors';
import { formatCOP, formatGrams } from '@/lib/format';
import { redact } from '@/lib/logger';

describe('errorCode', () => {
  it('extrae el código estable de un error de la base', () => {
    expect(errorCode({ message: 'allergen_conflict: la receta contiene un alérgeno' })).toBe('allergen_conflict');
    expect(errorKey(new Error('diet_conflict: no compatible'))).toBe('errors.diet_conflict');
  });

  it('reconoce el error genérico del registro de Supabase Auth', () => {
    expect(errorCode({ message: 'Database error saving new user' })).toBe('signup_failed');
  });

  it('nunca expone un código desconocido', () => {
    expect(errorCode({ message: 'relation "x" does not exist' })).toBe('unknown');
    expect(errorCode(undefined)).toBe('unknown');
  });

  it('detecta falta de conexión', () => {
    expect(errorCode(new TypeError('Network request failed'))).toBe('network');
  });
});

describe('formato', () => {
  it('muestra pesos sin decimales', () => {
    expect(formatCOP(12500.4)).toMatch(/^\$\s?12\.500$/);
  });

  it('muestra gramos y kilos', () => {
    expect(formatGrams(250)).toBe('250 g');
    expect(formatGrams(1500)).toBe('1,5 kg');
  });
});

describe('logger', () => {
  it('redacta campos sensibles aunque estén anidados', () => {
    expect(redact({ plan_id: 'p1', profile: { allergens: ['egg'], email: 'a@b.co' } })).toEqual({
      plan_id: 'p1',
      profile: { allergens: '[redactado]', email: '[redactado]' },
    });
  });
});
