/**
 * Agregado rápido (ADR-024): lo que casi toda cocina colombiana tiene, con una cantidad típica de compra.
 * Un toque lo pone en la despensa; después se puede ajustar. Así las recetas se adaptan desde el primer uso.
 */
export type QuickItem = { name: string; quantity: number; unitCode: 'g' | 'kg' | 'unit' };

export const QUICK_ITEMS: QuickItem[] = [
  { name: 'Arroz blanco', quantity: 1, unitCode: 'kg' },
  { name: 'Papa', quantity: 1, unitCode: 'kg' },
  { name: 'Huevo', quantity: 6, unitCode: 'unit' },
  { name: 'Tomate', quantity: 4, unitCode: 'unit' },
  { name: 'Cebolla cabezona', quantity: 2, unitCode: 'unit' },
  { name: 'Plátano verde', quantity: 2, unitCode: 'unit' },
  { name: 'Fríjol rojo seco', quantity: 500, unitCode: 'g' },
  { name: 'Lentejas secas', quantity: 500, unitCode: 'g' },
  { name: 'Pasta seca', quantity: 500, unitCode: 'g' },
  { name: 'Arepa de maíz', quantity: 5, unitCode: 'unit' },
  { name: 'Zanahoria', quantity: 3, unitCode: 'unit' },
  { name: 'Pechuga de pollo', quantity: 500, unitCode: 'g' },
  { name: 'Carne de res molida', quantity: 500, unitCode: 'g' },
  { name: 'Queso campesino', quantity: 250, unitCode: 'g' },
  { name: 'Banano', quantity: 4, unitCode: 'unit' },
  { name: 'Avena en hojuelas', quantity: 500, unitCode: 'g' },
];

/** Lo que aún no está en la despensa (por nombre, sin importar mayúsculas). */
export function missingQuickItems(pantryNames: string[]): QuickItem[] {
  const have = new Set(pantryNames.map((n) => n.toLowerCase()));
  return QUICK_ITEMS.filter((i) => !have.has(i.name.toLowerCase()));
}
