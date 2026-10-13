export type PantryItem = { id: string; ingredientId: string; name: string; grams: number; expiresOn: string | null };

export type Unit = { id: number; code: string; name: string; dimension: 'mass' | 'volume' | 'count' };

export type IngredientOption = { id: string; name: string; countUnits: Unit[] };

export type NewPantryItem = { ingredientId: string; quantity: number; unitId: number; expiresOn: string | null };

/** Puerto de la despensa. Falla con AppError. */
export interface PantryRepository {
  list(): Promise<PantryItem[]>;
  /** Convierte a gramos en la base y suma al lote con el mismo vencimiento (add_to_pantry). */
  add(item: NewPantryItem): Promise<void>;
  remove(id: string): Promise<void>;
  search(query: string): Promise<IngredientOption[]>;
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
