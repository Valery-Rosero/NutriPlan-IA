const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

/** Pesos colombianos sin decimales (AGENTS.md regla 10). */
export function formatCOP(amount: number) {
  return cop.format(Math.round(amount));
}

/** Gramos legibles: 1500 → "1,5 kg"; 250 → "250 g". */
export function formatGrams(grams: number) {
  if (grams >= 1000) return `${(grams / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg`;
  return `${Math.round(grams)} g`;
}

/** Fecha ISO "2026-10-14" → "martes 14 de octubre" (se interpreta como fecha local, sin hora). */
export function formatDay(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

/** Primera letra en mayúscula ("almuerzo" → "Almuerzo"), para etiquetas que vienen en minúscula. */
export function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
