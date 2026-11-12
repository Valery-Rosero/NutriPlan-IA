import { z } from 'zod';

export type BudgetPeriod = 'week' | 'month';

export type Profile = {
  id: string;
  regionId: number | null;
  householdSize: number;
  budgetAmount: number | null;
  budgetPeriod: BudgetPeriod | null;
  /** US-137: tope de minutos por receta; null = sin límite. */
  maxCookMinutes: number | null;
  /** US-136: % de kcal desde proteína (10–50). Dato sensible: requiere la autorización (ADR-011). */
  targetProteinPct: number | null;
  /** US-159: meta diaria de kcal (800–6000), opcional. Dato sensible. */
  dailyKcalTarget: number | null;
  onboardingCompletedAt: string | null;
};

export type ProfilePatch = Partial<Pick<Profile, 'regionId' | 'householdSize' | 'budgetAmount' | 'budgetPeriod' | 'maxCookMinutes' | 'targetProteinPct' | 'dailyKcalTarget'>> & {
  onboardingCompleted?: true;
};

export type CatalogOption = { id: number; code: string; name: string };

/** Alergias y dietas: restricciones DURAS (las aplica la base de datos, no la app). */
export type Restrictions = { allergenIds: number[]; dietIds: number[] };

/** Puerto del perfil y sus preferencias. Falla con AppError. */
export interface ProfileRepository {
  getProfile(): Promise<Profile>;
  updateProfile(patch: ProfilePatch): Promise<void>;
  getRestrictions(): Promise<Restrictions>;
  /** Reemplaza el conjunto completo en una transacción (RPC set_my_restrictions). */
  setRestrictions(restrictions: Restrictions): Promise<void>;
  listRegions(): Promise<CatalogOption[]>;
  listAllergens(): Promise<CatalogOption[]>;
  /** Solo dietas que se derivan de los ingredientes (las "curadas" requieren etiquetas de nutricionista). */
  listDiets(): Promise<CatalogOption[]>;
  /** US-138: solo cocinas con recetas publicadas (elegir una sin recetas no cambiaría nada). */
  listCuisines(): Promise<CatalogOption[]>;
  getCuisines(): Promise<number[]>;
  /** Reemplaza el conjunto completo en una transacción (RPC set_my_cuisines). */
  setCuisines(cuisineIds: number[]): Promise<void>;
}

// ---- Formularios (mensajes = claves i18n) ----
export const householdSchema = z.object({
  regionId: z.number({ error: 'validation.required' }),
  householdSize: z.number().int().min(1, { error: 'validation.householdSize' }).max(12, { error: 'validation.householdSize' }),
});
export type HouseholdForm = z.infer<typeof householdSchema>;

/** Presupuesto opcional (US-108): monto y periodo van juntos, como exige la base. */
export const budgetSchema = z
  .object({ amount: z.number().positive({ error: 'validation.budgetAmount' }).nullable(), period: z.enum(['week', 'month']) })
  .transform(({ amount, period }) => ({ budgetAmount: amount, budgetPeriod: amount === null ? null : period }));
export type BudgetFormInput = z.input<typeof budgetSchema>;

/** US-137: opciones de tiempo máximo (la base acepta 5–240 min). */
export const COOK_TIME_OPTIONS = [15, 20, 30, 45, 60] as const;

/**
 * Siguiente límite a proponer cuando no hay recetas que quepan en el actual
 * ("¿probamos con 30?"). Después del mayor, la propuesta es quitar el límite (null).
 */
export function nextCookTime(current: number): number | null {
  return COOK_TIME_OPTIONS.find((option) => option > current) ?? null;
}

/** US-136: opciones de proteína (el control es por pasos de 5; la base acepta 10–50). */
export const PROTEIN_OPTIONS = [15, 20, 25, 30, 35, 40, 45] as const;

/** Grasa fija en 30 % de las kcal (rango usual de referencia); los carbohidratos completan el 100 %. */
export const FAT_PCT = 30;

/**
 * Solo la proteína se elige; carbohidratos y grasa se derivan y siempre suman 100 % (no se guardan,
 * igual que en la base). Ej.: proteína 40 → carbohidratos 30, grasa 30.
 */
export function macroSplit(proteinPct: number) {
  return { protein: proteinPct, carbs: 100 - FAT_PCT - proteinPct, fat: FAT_PCT };
}

/** Meta diaria de kcal: vacío = sin meta; fuera de 800–6000 es inválida. */
export const kcalTargetSchema = z
  .number()
  .int()
  .min(800, { error: 'validation.kcalTarget' })
  .max(6000, { error: 'validation.kcalTarget' })
  .nullable();

/** Convierte "150.000" o "150000" a número (los pesos no llevan decimales en la UI). */
export function parseCop(text: string): number | null {
  const digits = text.replace(/\D/g, '');
  return digits === '' ? null : Number(digits);
}
