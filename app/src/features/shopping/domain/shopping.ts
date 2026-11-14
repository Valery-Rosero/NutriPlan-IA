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
  /** US-147: si es un sustituto, el nombre de lo que reemplaza ("en lugar de pechuga"). */
  replacesName: string | null;
  /**
   * ADR-035 · A2: cómo se compra lo que falta (lo calcula la base): unidades, un poco, un pedazo pequeño,
   * litros o libras; `buyGrams` es lo que se compra de verdad (y lo que pasa a la despensa).
   */
  buyKind?: BuyKind | null;
  buyGrams?: number | null;
  buyUnits?: number | null;
};

export type BuyKind = 'none' | 'unit' | 'pinch' | 'piece' | 'ml' | 'weight';

/** `house`: la lista de la casa (sin plan, ADR-035). */
export type ShoppingList = { id: string; items: ShoppingItem[]; house?: boolean };

type T = (key: string, options?: Record<string, unknown>) => string;

/**
 * A2: "38 g de ahuyama" → "un pedazo pequeño"; "600 g de pollo" → "1 libra y media"; "300 ml de leche" →
 * "medio litro". Se dice como se pide en la plaza (sin fracciones con símbolos: el lector las lee mal).
 */
export function buyLabel(item: Pick<ShoppingItem, 'buyKind' | 'buyGrams' | 'buyUnits' | 'toBuyGrams'>, t: T): string | null {
  const grams = item.buyGrams ?? 0;
  switch (item.buyKind) {
    case 'unit':
      return t('shopping.buy.units', { count: item.buyUnits ?? 1 });
    case 'pinch':
      return t('shopping.buy.pinch');
    case 'piece':
      return t('shopping.buy.piece');
    case 'ml': {
      if (grams <= 750) return t(grams <= 250 ? 'shopping.buy.quarterLiter' : grams <= 500 ? 'shopping.buy.halfLiter' : 'shopping.buy.threeQuarterLiter');
      return halves(Math.ceil(grams / 500) / 2, 'liters', t);
    }
    case 'weight':
      if (grams > 3000) return t('shopping.buy.kg', { amount: (Math.ceil(grams / 500) / 2).toLocaleString('es-CO') });
      return grams <= 250 ? t('shopping.buy.halfPound') : halves(Math.ceil(grams / 250) / 2, 'pounds', t);
    default:
      return null;
  }
}

/** 1 → "1 libra", 1,5 → "1 libra y media", 2 → "2 libras" (igual con litros). */
function halves(n: number, unit: 'pounds' | 'liters', t: T) {
  const whole = Math.floor(n);
  return t(n - whole >= 0.5 ? `shopping.buy.${unit}Half` : `shopping.buy.${unit}`, { count: whole });
}

/** Puerto de la lista de compras. Falla con AppError. */
export interface ShoppingRepository {
  forPlan(planId: string): Promise<ShoppingList | null>;
  /** ADR-035 · A1: la lista de la casa (existe siempre; sin plan es la que se usa). */
  forHouse(): Promise<ShoppingList>;
  /** Necesidades del plan menos la despensa; idempotente y respeta lo ya marcado (US-124, US-125). */
  generate(planId: string): Promise<string>;
  setChecked(itemId: string, checked: boolean): Promise<void>;
  /** `storeCategoryId`: sección sugerida por la clasificación (B3); null = "Otros". */
  addManual(listId: string, name: string, storeCategoryId?: number | null): Promise<void>;
  /** ADR-033: ingredientes del catálogo con sus gramos (receta, sugerencias): al comprarlos pasan a la despensa. */
  addIngredients(listId: string, items: { ingredientId: string; grams: number }[]): Promise<number>;
  /** M5: quitar se puede deshacer (la base solo la oculta). */
  remove(itemId: string): Promise<void>;
  restore(itemId: string): Promise<void>;
  /** Suma a la despensa lo marcado como comprado. Devuelve cuántos ítems pasaron. */
  moveCheckedToPantry(listId: string): Promise<number>;
  /** US-147: comprar el sustituto en lugar del ingrediente del plan; se recuerda al actualizar la lista. */
  substitute(itemId: string, substituteId: string): Promise<void>;
  undoSubstitution(itemId: string): Promise<void>;
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

/**
 * Lo que sigue en la lista. Lo que ya pasó a la despensa (o lo manual que se cerró con esa compra)
 * sale de la lista: la compra terminó. `closed` dice cuántos se cerraron, para avisarlo.
 */
export function splitClosed(items: ShoppingItem[]) {
  const open = items.filter((i) => !i.movedToPantry);
  return { open, closed: items.length - open.length };
}

export function pendingToPantry(items: ShoppingItem[]) {
  return items.filter((i) => i.checked && !i.movedToPantry && i.ingredientId !== null && (i.toBuyGrams ?? 0) > 0).length;
}
