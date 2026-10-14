import type { SupabaseClient } from '@supabase/supabase-js';

import { AppError, toAppError } from '@/core/errors/app-error';
import type { ProfilePatch, ProfileRepository, Restrictions } from '@/features/profile/domain/profile';
import type { Database } from '@/types/database';

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export class SupabaseProfileRepository implements ProfileRepository {
  private readonly client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  private async userId() {
    const { data } = await this.client.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new AppError('unknown');
    return id;
  }

  async getProfile() {
    const { data, error } = await this.client
      .from('profiles')
      .select('id, region_id, household_size, budget_amount, budget_period, max_cook_minutes, onboarding_completed_at')
      .single();
    if (error) throw toAppError(error);
    return {
      id: data.id,
      regionId: data.region_id,
      householdSize: data.household_size,
      budgetAmount: data.budget_amount,
      budgetPeriod: data.budget_period,
      maxCookMinutes: data.max_cook_minutes,
      onboardingCompletedAt: data.onboarding_completed_at,
    };
  }

  async updateProfile(patch: ProfilePatch) {
    const update: ProfileUpdate = {};
    if (patch.regionId !== undefined) update.region_id = patch.regionId;
    if (patch.householdSize !== undefined) update.household_size = patch.householdSize;
    if (patch.budgetAmount !== undefined) update.budget_amount = patch.budgetAmount;
    if (patch.budgetPeriod !== undefined) update.budget_period = patch.budgetPeriod;
    if (patch.maxCookMinutes !== undefined) update.max_cook_minutes = patch.maxCookMinutes;
    if (patch.onboardingCompleted) update.onboarding_completed_at = new Date().toISOString();
    const { error } = await this.client.from('profiles').update(update).eq('id', await this.userId());
    if (error) throw toAppError(error);
  }

  async getRestrictions(): Promise<Restrictions> {
    const [allergens, diets] = await Promise.all([
      this.client.from('user_allergens').select('allergen_id'),
      this.client.from('user_diets').select('diet_id'),
    ]);
    if (allergens.error) throw toAppError(allergens.error);
    if (diets.error) throw toAppError(diets.error);
    return { allergenIds: allergens.data.map((a) => a.allergen_id), dietIds: diets.data.map((d) => d.diet_id) };
  }

  async setRestrictions({ allergenIds, dietIds }: Restrictions) {
    const { error } = await this.client.rpc('set_my_restrictions', { p_allergen_ids: allergenIds, p_diet_ids: dietIds });
    if (error) throw toAppError(error);
  }

  async listRegions() {
    const { data, error } = await this.client.from('regions').select('id, code, name, parent_id').order('name');
    if (error) throw toAppError(error);
    // Solo ciudades (regiones sin hijas): son las que tienen precios propios o heredados.
    const parents = new Set(data.map((r) => r.parent_id).filter((id) => id !== null));
    return data.filter((r) => !parents.has(r.id)).map(({ id, code, name }) => ({ id, code, name }));
  }

  async listAllergens() {
    const { data, error } = await this.client.from('allergens').select('id, code, name').order('name');
    if (error) throw toAppError(error);
    return data;
  }

  async listDiets() {
    const { data, error } = await this.client.from('diets').select('id, code, name').eq('kind', 'rule_based').order('name');
    if (error) throw toAppError(error);
    return data;
  }

  async listCuisines() {
    // !inner: solo cocinas con al menos una receta visible (RLS deja ver las publicadas).
    const { data, error } = await this.client
      .from('cuisines')
      .select('id, code, name, recipes!inner(id)')
      .eq('recipes.status', 'published')
      .order('name');
    if (error) throw toAppError(error);
    return data.map(({ id, code, name }) => ({ id, code, name }));
  }

  async getCuisines() {
    const { data, error } = await this.client.from('user_cuisines').select('cuisine_id');
    if (error) throw toAppError(error);
    return data.map((c) => c.cuisine_id);
  }

  async setCuisines(cuisineIds: number[]) {
    const { error } = await this.client.rpc('set_my_cuisines', { p_cuisine_ids: cuisineIds });
    if (error) throw toAppError(error);
  }
}
