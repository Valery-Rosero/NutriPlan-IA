import type { SupabaseClient } from '@supabase/supabase-js';

import { toAppError } from '@/core/errors/app-error';
import type { ShoppingList, ShoppingRepository } from '@/features/shopping/domain/shopping';
import type { Database } from '@/types/database';

export class SupabaseShoppingRepository implements ShoppingRepository {
  private readonly client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  async forPlan(planId: string): Promise<ShoppingList | null> {
    const list = await this.client.from('shopping_lists').select('id').eq('plan_id', planId).maybeSingle();
    if (list.error) throw toAppError(list.error);
    if (!list.data) return null;

    const { data, error } = await this.client.from('my_shopping_items').select('*').eq('list_id', list.data.id);
    if (error) throw toAppError(error);
    return {
      id: list.data.id,
      items: data.map((r) => ({
        id: r.id!,
        ingredientId: r.ingredient_id,
        name: r.name ?? '',
        categoryName: r.category_name,
        categoryPosition: r.category_position ?? 99,
        toBuyGrams: r.to_buy_g,
        pantryGrams: r.pantry_g ?? 0,
        approxUnits: r.approx_units,
        checked: !!r.is_checked,
        source: r.source ?? 'manual',
        movedToPantry: r.moved_to_pantry_at !== null,
      })),
    };
  }

  async generate(planId: string) {
    const { data, error } = await this.client.rpc('generate_shopping_list', { p_plan_id: planId });
    if (error) throw toAppError(error);
    return data;
  }

  async setChecked(itemId: string, checked: boolean) {
    const { error } = await this.client
      .from('shopping_list_items')
      .update({ is_checked: checked, checked_at: checked ? new Date().toISOString() : null })
      .eq('id', itemId);
    if (error) throw toAppError(error);
  }

  async addManual(listId: string, name: string) {
    const { error } = await this.client.from('shopping_list_items').insert({ list_id: listId, custom_name: name.trim(), source: 'manual' });
    if (error) throw toAppError(error);
  }

  async remove(itemId: string) {
    const { error } = await this.client.from('shopping_list_items').delete().eq('id', itemId);
    if (error) throw toAppError(error);
  }

  async moveCheckedToPantry(listId: string) {
    const { data, error } = await this.client.rpc('move_checked_to_pantry', { p_list_id: listId });
    if (error) throw toAppError(error);
    return data;
  }
}
