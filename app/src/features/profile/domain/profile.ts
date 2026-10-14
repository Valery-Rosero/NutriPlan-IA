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
  onboardingCompletedAt: string | null;
};

export type ProfilePatch = Partial<Pick<Profile, 'regionId' | 'householdSize' | 'budgetAmount' | 'budgetPeriod' | 'maxCookMinutes'>> & {
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

/** Convierte "150.000" o "150000" a número (los pesos no llevan decimales en la UI). */
export function parseCop(text: string): number | null {
  const digits = text.replace(/\D/g, '');
  return digits === '' ? null : Number(digits);
}
