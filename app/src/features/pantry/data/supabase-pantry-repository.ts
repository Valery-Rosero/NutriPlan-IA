import type { SupabaseClient } from '@supabase/supabase-js';

import { toAppError } from '@/core/errors/app-error';
import type { IngredientOption, NewPantryItem, PantryRepository, Unit } from '@/features/pantry/domain/pantry';
import type { Database } from '@/types/database';

export class SupabasePantryRepository implements PantryRepository {
  private readonly client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  async list() {
    const { data, error } = await this.client
      .from('pantry_items')
      .select('id, ingredient_id, quantity_g, expires_on, ingredients!inner(name)')
      .gt('quantity_g', 0);
    if (error) throw toAppError(error);
    return data.map((row) => ({
      id: row.id,
      ingredientId: row.ingredient_id,
      name: row.ingredients.name,
      grams: row.quantity_g,
      expiresOn: row.expires_on,
    }));
  }

  async add({ ingredientId, quantity, unitId, expiresOn }: NewPantryItem) {
    const { error } = await this.client.rpc('add_to_pantry', {
      p_ingredient_id: ingredientId,
      p_quantity: quantity,
      p_unit_id: unitId,
      p_expires_on: expiresOn ?? undefined,
    });
    if (error) throw toAppError(error);
  }

  async remove(id: string) {
    const { error } = await this.client.from('pantry_items').delete().eq('id', id);
    if (error) throw toAppError(error);
  }

  async search(query: string): Promise<IngredientOption[]> {
    const { data, error } = await this.client.rpc('search_ingredients', { p_query: query, p_limit: 15 });
    if (error) throw toAppError(error);
    if (data.length === 0) return [];

    const weights = await this.client
      .from('ingredient_unit_weights')
      .select('ingredient_id, units!inner(id, code, name, dimension)')
      .in('ingredient_id', data.map((i) => i.id));
    if (weights.error) throw toAppError(weights.error);

    return data.map((ingredient) => ({
      id: ingredient.id,
      name: ingredient.name,
      countUnits: weights.data.filter((w) => w.ingredient_id === ingredient.id).map((w) => w.units as Unit),
    }));
  }

  async findByNames(names: string[]) {
    const { data, error } = await this.client.from('ingredients').select('id, name, shelf_life_days').in('name', names);
    if (error) throw toAppError(error);
    return data.map((i) => ({ id: i.id, name: i.name, shelfLifeDays: i.shelf_life_days }));
  }

  async listUnits() {
    const { data, error } = await this.client.from('units').select('id, code, name, dimension');
    if (error) throw toAppError(error);
    return data;
  }
}
