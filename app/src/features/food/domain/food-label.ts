import type { MealSlot } from '@/features/cooking/domain/cooking';

/**
 * B3 (ADR-027): clasificación de un texto libre ("queso campesino", "bolsas", "empanada").
 * La hace la Edge Function categorize-food: caché → catálogo → IA (listas cerradas) → reglas.
 * Es INFORMATIVA: nunca se usa para filtrar alergias.
 */
export type FoodLabel = {
  name: string;
  isFood: boolean;
  foodGroupId: number | null;
  /** Sección del supermercado; null solo si la función respondió sin poder leer la base. */
  storeCategoryId: number | null;
  mealSlot: MealSlot | null;
  kcalPerServing: number | null;
  proteinPerServing: number | null;
  source: 'cache' | 'catalog' | 'ai' | 'rules';
};

/** Puerto de la clasificación. Falla con AppError. */
export interface FoodLabelRepository {
  classify(text: string): Promise<FoodLabel>;
}

/** Cuánto se espera la clasificación antes de seguir sin ella. */
export const CLASSIFY_TIMEOUT_MS = 4000;

/**
 * Clasifica sin estorbar: si falla o se demora más de `ms`, devuelve null y quien la usa sigue
 * (por ejemplo, el ítem entra a la lista en "Otros"). Nunca lanza.
 */
export async function classifyQuietly(repo: FoodLabelRepository, text: string, ms = CLASSIFY_TIMEOUT_MS): Promise<FoodLabel | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      repo.classify(text),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
