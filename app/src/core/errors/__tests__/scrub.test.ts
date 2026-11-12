import { createDeduper, scrubErrorText, toErrorReport } from '@/core/errors/scrub';

describe('limpieza de fallas (US-122)', () => {
  it('quita correos, tokens, ids y números largos', () => {
    const dirty =
      'ana@correo.com eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.firma 3f2a1c4e-1111-4222-8333-444455556666 tel 3001234567 línea 42';
    expect(scrubErrorText(dirty, 500)).toBe('[correo] [token] [id] tel [número] línea 42');
  });

  it('acota el largo', () => {
    expect(scrubErrorText('a'.repeat(900), 500)).toHaveLength(500);
  });

  it('convierte cualquier cosa lanzada en un reporte limpio, con pila corta', () => {
    const error = new TypeError('No se pudo leer ana@correo.com');
    const report = toErrorReport(error, 'Hoy');
    expect(report).toMatchObject({ name: 'TypeError', message: 'No se pudo leer [correo]', screen: 'Hoy' });
    expect(report.stack!.split('\n').length).toBeLessThanOrEqual(15);
    expect(toErrorReport('texto suelto')).toMatchObject({ name: 'Error', message: 'texto suelto' });
  });

  it('no repite la misma falla dentro de la ventana', () => {
    let t = 0;
    const shouldSend = createDeduper(60_000, () => t);
    const r = toErrorReport(new Error('boom'));
    expect(shouldSend(r)).toBe(true);
    t = 30_000;
    expect(shouldSend(r)).toBe(false);
    t = 61_000;
    expect(shouldSend(r)).toBe(true);
  });
});
