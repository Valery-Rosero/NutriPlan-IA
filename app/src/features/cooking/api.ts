import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type MealSlot = Database['public']['Enums']['meal_slot'];
export type MissingIngredient = { ingredient_id: string; ingredient_name: string; missing_g: number };

/** "¿Qué cocino con lo que tengo?" (ADR-020): recetas seguras ordenadas por cobertura de la despensa. */
export function useCookWithWhatIHave(slot?: MealSlot) {
  return useQuery({
    queryKey: ['cooking', 'suggestions', { slot }],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('cook_with_what_i_have', { p_slot: slot });
      if (error) throw error;
      return data.map((row) => ({ ...row, missing: row.missing as unknown as MissingIngredient[] }));
    },
  });
}
