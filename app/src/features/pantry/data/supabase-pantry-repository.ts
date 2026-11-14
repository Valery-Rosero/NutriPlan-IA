import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';

import { AppError, toAppError } from '@/core/errors/app-error';
import type {
  BuyNext,
  CustomUnit,
  FoodGroup,
  IngredientOption,
  NewCustomPantryItem,
  NewPantryItem,
  PantryItem,
  PantryRepository,
  PantryPhoto,
  PhotoKind,
  UnderstoodPantry,
  UnderstoodPhoto,
  Unit,
} from '@/features/pantry/domain/pantry';
import type { Database } from '@/types/database';

type RemoteItem = {
  ingredient_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  units: string[];
  expires_in_days: number | null;
  uncertain?: boolean;
};
const toParsed = (i: RemoteItem) => ({
  ingredientId: i.ingredient_id,
  name: i.name,
  quantity: i.quantity,
  unit: i.unit,
  units: i.units,
  expiresInDays: i.expires_in_days,
  uncertain: !!i.uncertain,
});

export class SupabasePantryRepository implements PantryRepository {
  private readonly client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  /** Lo del catálogo y los alimentos propios (B3b), juntos. */
  async list(): Promise<PantryItem[]> {
    const [catalog, custom] = await Promise.all([
      this.client
        .from('pantry_items')
        .select('id, ingredient_id, quantity_g, expires_on, ingredients!inner(name, food_group_id, shelf_life_days, ingredient_unit_weights(grams, units!inner(code, name)))')
        .gt('quantity_g', 0),
      this.client.from('pantry_custom_items').select('id, name, quantity, unit, expires_on, food_group_id'),
    ]);
    if (catalog.error) throw toAppError(catalog.error);
    if (custom.error) throw toAppError(custom.error);
    return [
      ...catalog.data.map((row) => {
        // − / + de a una unidad contable ("unidad" primero; si no, la que tenga: "diente", "taza"…).
        const weights = row.ingredients.ingredient_unit_weights ?? [];
        const unit = weights.find((w) => w.units.code === 'unit') ?? weights[0];
        return {
          id: row.id,
          ingredientId: row.ingredient_id,
          name: row.ingredients.name,
          grams: Number(row.quantity_g),
          expiresOn: row.expires_on,
          custom: null,
          foodGroupId: row.ingredients.food_group_id,
          shelfLifeDays: row.ingredients.shelf_life_days,
          unitGrams: unit ? Number(unit.grams) : null,
          unitName: unit ? unit.units.name : null,
        };
      }),
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

  async adjust(ingredientId: string, quantity: number, unitId: number | null = null) {
    const { data, error } = await this.client.rpc('adjust_pantry', {
      p_ingredient_id: ingredientId,
      p_quantity: Math.round(quantity * 100) / 100,
      ...(unitId === null ? {} : { p_unit_id: unitId }),
    });
    if (error) throw toAppError(error);
    return Number(data);
  }

  async setExpiry(lotId: string, expiresOn: string | null) {
    // La base acepta null (sin fecha); el tipo generado no lo refleja.
    const { error } = await this.client.rpc('set_pantry_expiry', { p_item_id: lotId, p_expires_on: expiresOn as string });
    if (error) throw toAppError(error);
  }

  async removeExpired() {
    const { data, error } = await this.client.rpc('remove_expired_pantry');
    if (error) throw toAppError(error);
    return data;
  }

  async updateCustom(id: string, patch: { quantity?: number; expiresOn?: string | null }) {
    const { error } = await this.client
      .from('pantry_custom_items')
      .update({
        ...(patch.quantity === undefined ? {} : { quantity: patch.quantity }),
        ...(patch.expiresOn === undefined ? {} : { expires_on: patch.expiresOn }),
      })
      .eq('id', id);
    if (error) throw toAppError(error);
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

  async understand(text: string): Promise<UnderstoodPantry> {
    type Payload = {
      ok: boolean;
      data?: {
        source: 'ai' | 'rules';
        items: { ingredient_id: string | null; name: string; quantity: number; unit: string; units: string[]; expires_in_days: number | null }[];
      };
      error?: { code: string };
    };
    const { data, error } = await this.client.functions.invoke<Payload>('understand-pantry', { body: { text } });
    if (error) {
      const body = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
      throw toAppError(body?.error?.code ?? error);
    }
    if (!data?.ok || !data.data) throw new AppError('unknown');
    return {
      source: data.data.source,
      items: data.data.items.map(toParsed),
    };
  }

  async understandPhoto(photo: PantryPhoto, kind: PhotoKind): Promise<UnderstoodPhoto> {
    type Payload = {
      ok: boolean;
      data?: { items: RemoteItem[]; total: number | null; problem: 'no_food' | 'unclear' | null };
      error?: { code: string };
    };
    const { data, error } = await this.client.functions.invoke<Payload>('understand-pantry', {
      body: { image: { data: photo.base64, mime_type: photo.mimeType }, kind },
    });
    if (error) {
      const body = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
      throw toAppError(body?.error?.code ?? error);
    }
    if (!data?.ok || !data.data) throw new AppError('unknown');
    return { items: data.data.items.map(toParsed), total: data.data.total, problem: data.data.problem };
  }

  async buyNext(limit: number): Promise<BuyNext[]> {
    const { data, error } = await this.client.rpc('what_to_buy_next', { p_limit: limit });
    if (error) throw toAppError(error);
    return data.map((r) => ({
      ingredientId: r.ingredient_id, name: r.name, completes: r.completes, helps: r.helps, recipes: r.recipes, grams: Number(r.grams),
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
      shelfLifeDays: ingredient.shelf_life_days,
      countUnits: weights.data.filter((w) => w.ingredient_id === ingredient.id).map((w) => w.units as Unit),
    }));
  }

  async quickItems() {
    const { data, error } = await this.client
      .from('quick_add_items')
      .select('ingredient_id, quantity, unit_id, ingredients!inner(name, shelf_life_days)')
      .order('position');
    if (error) throw toAppError(error);
    return data.map((r) => ({
      ingredientId: r.ingredient_id,
      name: r.ingredients.name,
      quantity: Number(r.quantity),
      unitId: r.unit_id,
      shelfLifeDays: r.ingredients.shelf_life_days,
    }));
  }

  async listUnits() {
    const { data, error } = await this.client.from('units').select('id, code, name, dimension');
    if (error) throw toAppError(error);
    return data;
  }
}
