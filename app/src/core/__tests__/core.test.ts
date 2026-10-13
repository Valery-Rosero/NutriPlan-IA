import { AppError, errorKey, toAppError } from '@/core/errors/app-error';
import { formatCOP, formatGrams } from '@/core/format';
import { redact } from '@/infrastructure/logger';

describe('toAppError', () => {
  it('extrae el código estable de un error de la base', () => {
    expect(toAppError({ message: 'allergen_conflict: la receta contiene un alérgeno' }).code).toBe('allergen_conflict');
    expect(errorKey(new Error('diet_conflict: no compatible'))).toBe('errors.diet_conflict');
  });

  it('conserva un AppError tal cual', () => {
    const error = new AppError('email_taken');
    expect(toAppError(error)).toBe(error);
  });

  it('nunca expone un código desconocido', () => {
    expect(toAppError({ message: 'relation "x" does not exist' }).code).toBe('unknown');
    expect(toAppError(undefined).code).toBe('unknown');
  });

  it('detecta falta de conexión', () => {
    expect(toAppError(new TypeError('Network request failed')).code).toBe('network');
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
