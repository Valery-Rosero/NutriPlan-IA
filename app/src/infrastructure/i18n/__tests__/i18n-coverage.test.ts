import { ERROR_CODES } from '@/core/errors/app-error';
import esCO from '@/infrastructure/i18n/es-CO.json';

// Ningún error llega a la persona como un código crudo: todos tienen texto en español (AGENTS.md regla 10).
describe('cobertura de textos es-CO', () => {
  it.each(ERROR_CODES)('errors.%s tiene texto', (code) => {
    expect((esCO.errors as Record<string, string>)[code]).toEqual(expect.any(String));
  });

  it.each(['pantry_expiring', 'pantry_match', 'variety', 'cuisine_favorite', 'user_request'])('reasons.%s tiene texto', (code) => {
    expect((esCO.reasons as Record<string, string>)[code]).toEqual(expect.any(String));
  });
});
