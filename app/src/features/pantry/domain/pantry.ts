/** Unidades de un alimento propio (B3b): se guarda lo que escribió la persona, sin pasar a gramos. */
export const CUSTOM_UNITS = ['g', 'kg', 'lb', 'ml', 'l', 'unit'] as const;
export type CustomUnit = (typeof CUSTOM_UNITS)[number];

export type PantryItem = {
  id: string;
  /** null = alimento propio, fuera del catálogo (B3b): no entra en recetas, plan ni lista. */
  ingredientId: string | null;
  name: string;
  /** Gramos (catálogo). En un alimento propio es 0: su cantidad va en `custom`. */
  grams: number;
  expiresOn: string | null;
  custom: { quantity: number; unit: CustomUnit } | null;
};

export type Unit = { id: number; code: string; name: string; dimension: 'mass' | 'volume' | 'count' };

export type IngredientOption = { id: string; name: string; countUnits: Unit[] };

export type NewPantryItem = { ingredientId: string; quantity: number; unitId: number; expiresOn: string | null };

/** B3b: un alimento que no está en el catálogo. Grupo y sección los sugiere la clasificación (opcionales). */
export type NewCustomPantryItem = {
  name: string;
  quantity: number;
  unit: CustomUnit;
  expiresOn: string | null;
  foodGroupId: number | null;
  storeCategoryId: number | null;
};

export type IngredientRef = { id: string; name: string; shelfLifeDays: number | null };

/** Puerto de la despensa. Falla con AppError. */
export interface PantryRepository {
  list(): Promise<PantryItem[]>;
  /** Convierte a gramos en la base y suma al lote con el mismo vencimiento (add_to_pantry). */
  add(item: NewPantryItem): Promise<void>;
  /** B3b: alimento fuera del catálogo (tabla aparte; no toca las funciones de recetas). */
  addCustom(item: NewCustomPantryItem): Promise<void>;
  /** Quita un lote del catálogo o un alimento propio (cada uno vive en su tabla). */
  remove(item: Pick<PantryItem, 'id' | 'ingredientId'>): Promise<void>;
  search(query: string): Promise<IngredientOption[]>;
  /** Ingredientes del catálogo por nombre exacto (agregado rápido). */
  findByNames(names: string[]): Promise<IngredientRef[]>;
  listUnits(): Promise<Unit[]>;
}

/** Unidades que tiene sentido ofrecer: masa siempre (g, kg, libra) y las contables con peso conocido. */
export function unitsFor(ingredient: IngredientOption, allUnits: Unit[]): Unit[] {
  const mass = ['g', 'lb', 'kg']
    .map((code) => allUnits.find((u) => u.code === code))
    .filter((u): u is Unit => !!u);
  return [...ingredient.countUnits, ...mass];
}

export type ExpiryStatus = 'none' | 'expired' | 'soon' | 'ok';

/** Por vencer = hoy o en los próximos 3 días (igual que las alertas del backend). Fechas ISO 'AAAA-MM-DD'. */
export function expiryStatus(expiresOn: string | null, today: string): ExpiryStatus {
  if (!expiresOn) return 'none';
  const days = daysBetween(today, expiresOn);
  if (days < 0) return 'expired';
  return days <= 3 ? 'soon' : 'ok';
}

export function daysBetween(fromIso: string, toIso: string) {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

/** Fecha local de hoy en ISO (la base usa la hora de Colombia, R8). */
export function todayIso(now = new Date()) {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Orden de la lista: lo vencido y lo que vence pronto primero; sin fecha al final. */
export function sortPantry(items: PantryItem[]): PantryItem[] {
  return [...items].sort((a, b) => {
    if (a.expiresOn === b.expiresOn) return a.name.localeCompare(b.name, 'es');
    if (!a.expiresOn) return 1;
    if (!b.expiresOn) return -1;
    return a.expiresOn.localeCompare(b.expiresOn);
  });
}

export type PantryGroupKey = 'expired' | 'soon' | 'rest';
export type PantryGroup = { key: PantryGroupKey; data: PantryItem[] };

/** Agrupa la cocina por urgencia (vencido, úsalo primero, el resto) conservando el orden; omite grupos vacíos. */
export function groupByUrgency(items: PantryItem[], today: string): PantryGroup[] {
  const groups: Record<PantryGroupKey, PantryItem[]> = { expired: [], soon: [], rest: [] };
  for (const item of items) {
    const status = expiryStatus(item.expiresOn, today);
    groups[status === 'expired' ? 'expired' : status === 'soon' ? 'soon' : 'rest'].push(item);
  }
  return (['expired', 'soon', 'rest'] as const).filter((key) => groups[key].length).map((key) => ({ key, data: groups[key] }));
}
