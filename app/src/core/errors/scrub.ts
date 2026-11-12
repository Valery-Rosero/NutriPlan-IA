/**
 * US-122: limpia el texto de una falla antes de enviarlo (la base lo vuelve a limpiar al insertar).
 * Fuera: correos, tokens (JWT), ids, números largos (teléfonos, documentos). Nunca se envía contenido
 * de la persona (alergias, salud): solo lo técnico que trae el error.
 */
export function scrubErrorText(text: string, max: number): string {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[correo]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)?/g, '[token]')
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '[id]')
    .replace(/[0-9]{6,}/g, '[número]')
    .slice(0, max);
}

export type ErrorReport = { name: string; message: string; stack: string | null; screen: string | null };

/** De cualquier cosa lanzada a un reporte limpio y acotado. */
export function toErrorReport(error: unknown, screen: string | null = null): ErrorReport {
  const e = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Error desconocido');
  return {
    name: scrubErrorText(e.name || 'Error', 120),
    message: scrubErrorText(e.message || '', 500),
    // Solo las primeras líneas de la pila: alcanzan para ubicar la falla.
    stack: e.stack ? scrubErrorText(e.stack.split('\n').slice(0, 15).join('\n'), 4000) : null,
    screen: screen ? scrubErrorText(screen, 120) : null,
  };
}

/** No repetir la misma falla (mismo nombre y mensaje) dentro de una ventana: un bucle no inunda la tabla. */
export function createDeduper(windowMs: number, now: () => number = Date.now) {
  const seen = new Map<string, number>();
  return (report: ErrorReport) => {
    const key = `${report.name}|${report.message}`;
    const last = seen.get(key);
    if (last !== undefined && now() - last < windowMs) return false;
    seen.set(key, now());
    return true;
  };
}
