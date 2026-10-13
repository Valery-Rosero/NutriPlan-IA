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
