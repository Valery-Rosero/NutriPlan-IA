/**
 * Agregado rápido (ADR-024, ADR-036): lo que casi toda cocina colombiana tiene, con una cantidad típica de
 * compra. Viene de la base (quick_add_items), ligado al ingrediente por su id: si el catálogo cambia un nombre,
 * no se rompe. Un toque lo pone en la despensa; después se puede ajustar o deshacer.
 */
export type QuickItem = { ingredientId: string; name: string; quantity: number; unitId: number; shelfLifeDays: number | null };

/** Lo que aún no está en la despensa (por ingrediente, no por nombre). */
export function missingQuickItems(items: QuickItem[], pantryIngredientIds: (string | null)[]): QuickItem[] {
  const have = new Set(pantryIngredientIds.filter((id): id is string => !!id));
  return items.filter((i) => !have.has(i.ingredientId));
}
