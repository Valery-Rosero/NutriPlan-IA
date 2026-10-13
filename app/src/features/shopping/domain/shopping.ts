export type ShoppingItem = {
  id: string;
  ingredientId: string | null;
  name: string;
  categoryName: string | null;
  categoryPosition: number;
  /** Lo que falta comprar (necesario − despensa). Nulo en ítems manuales. */
  toBuyGrams: number | null;
  pantryGrams: number;
  /** Unidades aproximadas para lo que se compra por unidad (huevos, tomates); lo calcula la base. */
  approxUnits: number | null;
  checked: boolean;
  source: 'plan' | 'manual';
  movedToPantry: boolean;
};

export type ShoppingList = { id: string; items: ShoppingItem[] };

/** Puerto de la lista de compras. Falla con AppError. */
export interface ShoppingRepository {
  forPlan(planId: string): Promise<ShoppingList | null>;
  /** Necesidades del plan menos la despensa; idempotente y respeta lo ya marcado (US-124, US-125). */
  generate(planId: string): Promise<string>;
  setChecked(itemId: string, checked: boolean): Promise<void>;
  addManual(listId: string, name: string): Promise<void>;
  remove(itemId: string): Promise<void>;
  /** Suma a la despensa lo marcado como comprado. Devuelve cuántos ítems pasaron. */
  moveCheckedToPantry(listId: string): Promise<number>;
}

export type ShoppingSection = { key: string; title: string | null; kind: 'buy' | 'have'; data: ShoppingItem[] };

/**
 * US-135: secciones del supermercado en el orden de la persona; al final, "ya lo tienes"
 * (ítems del plan que cubre la despensa), para que la lista sea solo lo que hay que comprar.
 */
export function toSections(items: ShoppingItem[]): ShoppingSection[] {
  const have = items.filter((i) => i.source === 'plan' && (i.toBuyGrams ?? 0) <= 0);
  const buy = items.filter((i) => !have.includes(i));
  const byCategory = new Map<string, ShoppingSection & { position: number }>();
  for (const item of buy) {
    const key = item.categoryName ?? '—';
    const section = byCategory.get(key) ?? { key, title: item.categoryName, kind: 'buy' as const, data: [], position: item.categoryPosition };
    section.data.push(item);
    byCategory.set(key, section);
  }
  const sections: ShoppingSection[] = [...byCategory.values()]
    .sort((a, b) => a.position - b.position)
    .map(({ position: _position, ...s }) => ({ ...s, data: s.data.sort((a, b) => a.name.localeCompare(b.name, 'es')) }));
  if (have.length) sections.push({ key: 'have', title: null, kind: 'have', data: have });
  return sections;
}

export function progress(items: ShoppingItem[]) {
  const toBuy = items.filter((i) => !(i.source === 'plan' && (i.toBuyGrams ?? 0) <= 0));
  return { done: toBuy.filter((i) => i.checked).length, total: toBuy.length };
}

/** Actualización optimista de una casilla (funciona sin conexión; se sincroniza después, ADR-014). */
export function applyChecked(list: ShoppingList, itemId: string, checked: boolean): ShoppingList {
  return { ...list, items: list.items.map((i) => (i.id === itemId ? { ...i, checked } : i)) };
}

export function pendingToPantry(items: ShoppingItem[]) {
  return items.filter((i) => i.checked && !i.movedToPantry && i.ingredientId !== null && (i.toBuyGrams ?? 0) > 0).length;
}
