import type { QuickItem } from '@/features/pantry/domain/quick-add';

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
  /**
   * Grupo de alimento (food_groups). Del catálogo viene del ingrediente; en un alimento propio lo sugirió la
   * clasificación con IA (ADR-027) y la persona lo puede cambiar. Ausente o null = "Otros".
   */
  foodGroupId?: number | null;
  /** Catálogo: gramos de una unidad contable ("1 huevo") para el − / + de a una; null = de a 100 g. */
  unitGrams?: number | null;
  unitName?: string | null;
  /** Catálogo: cuánto dura normalmente (días), para proponer la fecha. */
  shelfLifeDays?: number | null;
  /**
   * A6: el mismo ingrediente comprado en varias fechas se ve como UNA fila (total y fecha más próxima);
   * aquí van los lotes de verdad (cada uno con su fecha), para cambiar la fecha de cada uno.
   */
  lots?: PantryItem[];
};

export type FoodGroup = { id: number; code: string; name: string };

/**
 * ADR-030: una cosa que la IA entendió de un texto libre. Es solo una PROPUESTA: la persona la revisa antes
 * de guardar. `ingredientId` null = alimento propio. `units`: unidades válidas para guardarla.
 */
export type ParsedPantryItem = {
  ingredientId: string | null;
  name: string;
  quantity: number;
  unit: string;
  units: string[];
  expiresInDays: number | null;
  /** ADR-032 (foto): la IA no está segura de qué es; llega desmarcado y con aviso (F-3). */
  uncertain?: boolean;
};

export type UnderstoodPantry = { items: ParsedPantryItem[]; source: 'ai' | 'rules' };

/** ADR-032: foto de la nevera o de un recibo. */
export type PhotoKind = 'fridge' | 'receipt';
export type PantryPhoto = { base64: string; mimeType: string };
export type UnderstoodPhoto = {
  items: ParsedPantryItem[];
  /** Recibo: total pagado si se leyó con claridad (se pregunta antes de sumarlo al gasto del mes). */
  total: number | null;
  /** F-6: la foto no sirve. */
  problem: 'no_food' | 'unclear' | null;
};

/** ADR-030: qué comprar para completar recetas (lo calcula la base con lo que le falta a cada una). */
export type BuyNext = {
  ingredientId: string;
  name: string;
  completes: number;
  helps: number;
  recipes: string[];
  /** Cuánto comprar (lo que más falta entre esas recetas), para llevarlo a la lista como ingrediente. */
  grams: number;
};

export type Unit = { id: number; code: string; name: string; dimension: 'mass' | 'volume' | 'count' };

export type IngredientOption = { id: string; name: string; countUnits: Unit[]; shelfLifeDays?: number | null };

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


/** Puerto de la despensa. Falla con AppError. */
export interface PantryRepository {
  list(): Promise<PantryItem[]>;
  /** Convierte a gramos en la base y suma al lote con el mismo vencimiento (add_to_pantry). */
  add(item: NewPantryItem): Promise<void>;
  /** B3b: alimento fuera del catálogo (tabla aparte; no toca las funciones de recetas). */
  addCustom(item: NewCustomPantryItem): Promise<void>;
  /** Corrige el grupo de un alimento propio (lo que sugirió la IA es solo una sugerencia). */
  setCustomGroup(id: string, foodGroupId: number): Promise<void>;
  /** Grupos de alimento de la base (datos de referencia). */
  foodGroups(): Promise<FoodGroup[]>;
  /** "Escríbelo como lo dirías": la Edge Function understand-pantry (IA con respaldo de reglas). */
  understand(text: string): Promise<UnderstoodPantry>;
  /** ADR-032: lo que la IA ve en una foto (no se guarda). Sin IA falla con ai_unavailable. */
  understandPhoto(photo: PantryPhoto, kind: PhotoKind): Promise<UnderstoodPhoto>;
  /** Qué comprar para terminar recetas que casi se pueden hacer (RPC what_to_buy_next). */
  buyNext(limit: number): Promise<BuyNext[]>;
  /** Quita un lote del catálogo o un alimento propio (cada uno vive en su tabla). */
  remove(item: Pick<PantryItem, 'id' | 'ingredientId'>): Promise<void>;
  /**
   * ADR-034: suma (> 0) o resta (< 0) GRAMOS de un ingrediente; resta primero lo que vence antes.
   * Con `unitId` la cantidad va en esa unidad (deshacer el agregado rápido). Devuelve el total vigente.
   */
  adjust(ingredientId: string, quantity: number, unitId?: number | null): Promise<number>;
  /** Cambia la fecha de un lote (null = sin fecha); si ya hay uno con esa fecha, se juntan. */
  setExpiry(lotId: string, expiresOn: string | null): Promise<void>;
  /** "Quitar lo vencido" (catálogo y alimentos propios). Devuelve cuántos quitó. */
  removeExpired(): Promise<number>;
  /** Alimento propio: cambia cuánto queda o la fecha. */
  updateCustom(id: string, patch: { quantity?: number; expiresOn?: string | null }): Promise<void>;
  search(query: string): Promise<IngredientOption[]>;
  /** ADR-036: lo típico para agregar con un toque (quick_add_items, en orden). */
  quickItems(): Promise<QuickItem[]>;
  listUnits(): Promise<Unit[]>;
}

/** Unidades que tiene sentido ofrecer: masa siempre (g, kg, libra) y las contables con peso conocido. */
export function unitsFor(ingredient: IngredientOption, allUnits: Unit[]): Unit[] {
  const mass = ['g', 'lb', 'kg']
    .map((code) => allUnits.find((u) => u.code === code))
    .filter((u): u is Unit => !!u);
  return [...ingredient.countUnits, ...mass];
}

/** Fechas que se ofrecen al agregar o corregir. `auto` = lo normal para ese alimento (A5). */
export const EXPIRY_OPTIONS = [
  { key: 'none', days: null },
  { key: 'days3', days: 3 },
  { key: 'week1', days: 7 },
  { key: 'week2', days: 14 },
  { key: 'month1', days: 30 },
] as const;
export type ExpiryKey = (typeof EXPIRY_OPTIONS)[number]['key'] | 'auto';

/** Fecha ISO de una opción de vencimiento (null = sin fecha). */
export function expiryFor(key: ExpiryKey, shelfLifeDays: number | null | undefined, today = todayIso()): string | null {
  const days = key === 'auto' ? (shelfLifeDays ?? null) : (EXPIRY_OPTIONS.find((o) => o.key === key)?.days ?? null);
  return days === null ? null : addDays(today, days);
}

/** "Todavía sirve" (M2): se le dan 2 días más desde hoy; se puede ajustar después. */
export const STILL_GOOD_DAYS = 2;

/**
 * C3: de a cuánto suben y bajan − / +. Catálogo: una unidad si tiene ("1 huevo"), si no 100 g.
 * Alimento propio: en su unidad (de a 100 en g y ml, de a 1 en lo demás).
 */
export function stepFor(item: PantryItem): number {
  if (item.custom) return item.custom.unit === 'g' || item.custom.unit === 'ml' ? 100 : 1;
  return item.unitGrams && item.unitGrams > 0 ? item.unitGrams : 100;
}

/** Cuánto hay, en la medida en que se corrige: gramos (catálogo) o la cantidad del alimento propio. */
export const amountOf = (item: PantryItem) => (item.custom ? item.custom.quantity : item.grams);

/**
 * A6: un ingrediente del catálogo comprado en varias fechas → una sola fila con el total y la fecha más
 * próxima. Lo vencido queda aparte (tiene sus propias acciones) y los alimentos propios no se juntan.
 */
export function mergeLots(items: PantryItem[], today: string): PantryItem[] {
  const out: PantryItem[] = [];
  const byIngredient = new Map<string, PantryItem>();
  for (const item of items) {
    if (!item.ingredientId || item.custom || expiryStatus(item.expiresOn, today) === 'expired') {
      out.push(item);
      continue;
    }
    const group = byIngredient.get(item.ingredientId);
    if (!group) {
      const first: PantryItem = { ...item, lots: [item] };
      byIngredient.set(item.ingredientId, first);
      out.push(first);
      continue;
    }
    group.lots = [...(group.lots ?? []), item];
    group.grams += item.grams;
    // La fecha que manda es la más próxima (lo que hay que usar primero); sin fecha solo si ninguno tiene.
    if (item.expiresOn && (!group.expiresOn || item.expiresOn < group.expiresOn)) group.expiresOn = item.expiresOn;
  }
  return out;
}

/** Clave estable de una fila (para abrir su edición): el ingrediente si es del catálogo, si no el id. */
export const pantryKey = (item: PantryItem) => (item.ingredientId && item.lots ? `i:${item.ingredientId}` : `c:${item.id}`);

export type ExpiryStatus = 'none' | 'expired' | 'soon' | 'ok';

/**
 * D4 · la única regla de "vence pronto" en la app: hoy o en los próximos 3 días (igual que las alertas y
 * recipes_using_expiring_ingredients en la base).
 */
export const SOON_DAYS = 3;
export const isSoon = (daysLeft: number) => daysLeft >= 0 && daysLeft <= SOON_DAYS;

/** Fechas ISO 'AAAA-MM-DD'. */
export function expiryStatus(expiresOn: string | null, today: string): ExpiryStatus {
  if (!expiresOn) return 'none';
  const days = daysBetween(today, expiresOn);
  if (days < 0) return 'expired';
  return isSoon(days) ? 'soon' : 'ok';
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

/** Orden en que se muestran los grupos (de lo que más se cocina a lo que menos) y su emoji. */
export const FOOD_GROUP_ORDER = [
  'poultry', 'red_meat', 'fish', 'shellfish', 'egg', 'dairy', 'legumes', 'grains', 'tubers',
  'vegetables', 'fruits', 'nuts_seeds', 'fats_oils', 'herbs_spices', 'honey', 'other',
] as const;

export const FOOD_GROUP_EMOJI: Record<string, string> = {
  poultry: '🍗', red_meat: '🥩', fish: '🐟', shellfish: '🦐', egg: '🥚', dairy: '🧀', legumes: '🫘', grains: '🌾',
  tubers: '🥔', vegetables: '🥕', fruits: '🍓', nuts_seeds: '🥜', fats_oils: '🫒', herbs_spices: '🌿', honey: '🍯', other: '🧺',
};

export type PantrySection =
  | { key: 'expired' | 'soon'; group: null; data: PantryItem[] }
  | { key: string; group: FoodGroup | null; data: PantryItem[] };

/**
 * "Lo que tengo": primero lo vencido y lo que vence pronto (úsalo primero); el resto, por grupo de alimento
 * (ADR-027). Sin grupo conocido va a "Otros". Conserva el orden de entrada y omite secciones vacías.
 */
export function groupPantry(items: PantryItem[], today: string, groups: FoodGroup[]): PantrySection[] {
  const expired: PantryItem[] = [];
  const soon: PantryItem[] = [];
  const byGroup = new Map<string, PantryItem[]>();
  const codeOf = new Map(groups.map((g) => [g.id, g.code]));
  for (const item of items) {
    const status = expiryStatus(item.expiresOn, today);
    if (status === 'expired') expired.push(item);
    else if (status === 'soon') soon.push(item);
    else {
      const code = (item.foodGroupId != null && codeOf.get(item.foodGroupId)) || 'other';
      byGroup.set(code, [...(byGroup.get(code) ?? []), item]);
    }
  }
  const rank = (code: string) => {
    const i = (FOOD_GROUP_ORDER as readonly string[]).indexOf(code);
    return i === -1 ? FOOD_GROUP_ORDER.length : i;
  };
  const sections: PantrySection[] = [];
  if (expired.length) sections.push({ key: 'expired', group: null, data: expired });
  if (soon.length) sections.push({ key: 'soon', group: null, data: soon });
  for (const code of [...byGroup.keys()].sort((a, b) => rank(a) - rank(b))) {
    sections.push({ key: `group-${code}`, group: groups.find((g) => g.code === code) ?? null, data: byGroup.get(code)! });
  }
  return sections;
}
