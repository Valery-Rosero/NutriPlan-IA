import type { SupabaseClient } from '@supabase/supabase-js';

import { toAppError } from '@/core/errors/app-error';
import type {
  CustomUnit,
  FoodGroup,
  IngredientOption,
  NewCustomPantryItem,
  NewPantryItem,
  PantryItem,
  PantryRepository,
  Unit,
} from '@/features/pantry/domain/pantry';
import type { Database } from '@/types/database';

export class SupabasePantryRepository implements PantryRepository {
  private readonly client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  /** Lo del catálogo y los alimentos propios (B3b), juntos. */
  async list(): Promise<PantryItem[]> {
    const [catalog, custom] = await Promise.all([
      this.client.from('pantry_items').select('id, ingredient_id, quantity_g, expires_on, ingredients!inner(name, food_group_id)').gt('quantity_g', 0),
      this.client.from('pantry_custom_items').select('id, name, quantity, unit, expires_on, food_group_id'),
    ]);
    if (catalog.error) throw toAppError(catalog.error);
    if (custom.error) throw toAppError(custom.error);
    return [
      ...catalog.data.map((row) => ({
        id: row.id,
        ingredientId: row.ingredient_id,
        name: row.ingredients.name,
        grams: row.quantity_g,
        expiresOn: row.expires_on,
        custom: null,
        foodGroupId: row.ingredients.food_group_id,
      })),
      ...custom.data.map((row) => ({
        id: row.id,
        ingredientId: null,
        name: row.name,
        grams: 0,
        expiresOn: row.expires_on,
        custom: { quantity: Number(row.quantity), unit: row.unit as CustomUnit },
        foodGroupId: row.food_group_id,
      })),
    ];
  }

  async setCustomGroup(id: string, foodGroupId: number) {
    const { error } = await this.client.from('pantry_custom_items').update({ food_group_id: foodGroupId }).eq('id', id);
    if (error) throw toAppError(error);
  }

  async foodGroups(): Promise<FoodGroup[]> {
    const { data, error } = await this.client.from('food_groups').select('id, code, name').order('id');
    if (error) throw toAppError(error);
    return data;
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

  async addCustom({ name, quantity, unit, expiresOn, foodGroupId, storeCategoryId }: NewCustomPantryItem) {
    const { error } = await this.client.from('pantry_custom_items').insert({
      name: name.trim(),
      quantity,
      unit,
      expires_on: expiresOn,
      food_group_id: foodGroupId,
      store_category_id: storeCategoryId,
    });
    if (error) throw toAppError(error);
  }

  async remove({ id, ingredientId }: Pick<PantryItem, 'id' | 'ingredientId'>) {
    const table = ingredientId === null ? 'pantry_custom_items' : 'pantry_items';
    const { error } = await this.client.from(table).delete().eq('id', id);
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
