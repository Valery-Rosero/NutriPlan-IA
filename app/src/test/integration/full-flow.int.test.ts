/**
 * Recorrido completo de una familia con los adaptadores REALES contra Supabase local (catálogo real cargado).
 * Verifica las consultas de verdad (PostgREST, RLS, RPC), no dobles. Variables: SUPABASE_URL y SUPABASE_ANON_KEY
 * (por defecto, las de `npx supabase start`).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { SupabaseAccountRepository } from '@/features/account/data/supabase-account-repository';
import { SupabaseAuthRepository } from '@/features/auth/data/supabase-auth-repository';
import { SupabaseCookingRepository } from '@/features/cooking/data/supabase-cooking-repository';
import { legalDrafts } from '@/features/legal/data/legal-drafts.generated';
import { SupabaseLegalRepository } from '@/features/legal/data/supabase-legal-repository';
import { latestByKind, requiredConsents } from '@/features/legal/domain/legal';
import { SupabasePantryRepository } from '@/features/pantry/data/supabase-pantry-repository';
import { todayIso, unitsFor } from '@/features/pantry/domain/pantry';
import { SupabasePlanRepository } from '@/features/plan/data/supabase-plan-repository';
import { SupabaseProfileRepository } from '@/features/profile/data/supabase-profile-repository';
import { SupabaseRecipeRepository } from '@/features/recipes/data/supabase-recipe-repository';
import { initialChoices } from '@/features/recipes/domain/recipe';
import { SupabaseShoppingRepository } from '@/features/shopping/data/supabase-shopping-repository';
import type { Database } from '@/types/database';

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const KEY = process.env.SUPABASE_ANON_KEY ?? '';

const memory = new Map<string, string>();
const client: SupabaseClient<Database> = createClient<Database>(URL, KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: false,
    storage: { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => void memory.set(k, v), removeItem: (k) => void memory.delete(k) },
  },
});

const auth = new SupabaseAuthRepository(client, (p) => `nutriplan://${p}`);
const legal = new SupabaseLegalRepository(client, legalDrafts);
const profile = new SupabaseProfileRepository(client);
const pantry = new SupabasePantryRepository(client);
const cooking = new SupabaseCookingRepository(client);
const recipes = new SupabaseRecipeRepository(client);
const plans = new SupabasePlanRepository(client);
const shopping = new SupabaseShoppingRepository(client);
const account = new SupabaseAccountRepository(client);

const run = KEY ? describe : describe.skip;

run('recorrido completo contra Supabase real', () => {
  let eggId: number;
  let planId: string;

  it('1. registro con los documentos vigentes y mayoría de edad', async () => {
    const current = latestByKind(await legal.getCurrentDocuments());
    const outcome = await auth.signUp({
      email: `familia${Date.now()}@test.dev`,
      password: 'Arepa2026',
      privacyPolicyDocumentId: current.get('privacy_policy')!.id,
      termsDocumentId: current.get('terms')!.id,
      isAdult: true,
    });
    expect(outcome).toBe('signed_in'); // en local la confirmación de correo está apagada
    expect(await auth.getSession()).not.toBeNull();
  });

  it('2. consentimientos pendientes: aviso de salud; al aceptarlo, la puerta se abre', async () => {
    const [current, pending, accepted] = await Promise.all([legal.getCurrentDocuments(), legal.getPendingConsents(), legal.getAcceptedKinds()]);
    const required = requiredConsents(current, pending, accepted);
    expect(required.map((d) => d.kind)).toEqual(['health_disclaimer']);
    await legal.accept(required.map((d) => d.id));
    expect(requiredConsents(current, await legal.getPendingConsents(), await legal.getAcceptedKinds())).toEqual([]);
  });

  it('3. perfil: región Pasto, hogar y catálogos de opciones', async () => {
    const regions = await profile.listRegions();
    const pasto = regions.find((r) => r.code === 'CO-NAR-PASTO')!;
    await profile.updateProfile({ regionId: pasto.id, householdSize: 4, budgetAmount: 150000, budgetPeriod: 'week' });
    const me = await profile.getProfile();
    expect(me).toMatchObject({ regionId: pasto.id, householdSize: 4, budgetAmount: 150000, budgetPeriod: 'week' });
    eggId = (await profile.listAllergens()).find((a) => a.code === 'egg')!.id;
    expect((await profile.listDiets()).length).toBeGreaterThan(0);
  });

  it('4. alergias: sin autorización se rechazan; con autorización se guardan', async () => {
    await expect(profile.setRestrictions({ allergenIds: [eggId], dietIds: [] })).rejects.toMatchObject({
      code: 'sensitive_authorization_required',
    });
    const sensitive = (await legal.getCurrentDocuments()).find((d) => d.kind === 'sensitive_data_authorization')!;
    await legal.accept([sensitive.id]);
    await profile.setRestrictions({ allergenIds: [eggId], dietIds: [] });
    expect(await profile.getRestrictions()).toEqual({ allergenIds: [eggId], dietIds: [] });
  });

  it('5. despensa: buscar sin tilde, agregar en libras y por unidades, listar', async () => {
    const units = await pantry.listUnits();
    const [papa] = await pantry.search('papa');
    expect(papa.name).toBe('Papa');
    const lb = unitsFor(papa, units).find((u) => u.code === 'lb')!;
    await pantry.add({ ingredientId: papa.id, quantity: 2, unitId: lb.id, expiresOn: null });
    const [cerdo] = await pantry.search('cerdo');
    const g = units.find((u) => u.code === 'g')!;
    await pantry.add({ ingredientId: cerdo.id, quantity: 600, unitId: g.id, expiresOn: todayIso() });
    const items = await pantry.list();
    expect(items.find((i) => i.name === 'Papa')?.grams).toBe(1000);
    expect(items.find((i) => i.name === 'Cerdo')?.grams).toBe(600);
  });

  it('6. "¿Qué cocino?": sugerencias seguras (ninguna resuelve con huevo)', async () => {
    const suggestions = await cooking.suggestions();
    expect(suggestions.length).toBeGreaterThan(3);
    for (const s of suggestions.slice(0, 6)) {
      const preview = await recipes.preview(s.recipeId, 4, []);
      expect(preview.allergens).not.toContain('egg');
    }
  });

  it('7. receta: detalle, vista previa con la despensa, cocinar y calificar', async () => {
    const [first] = await cooking.suggestions('lunch');
    const detail = await recipes.getDetail(first.recipeId);
    expect(detail.steps.length).toBeGreaterThan(0);
    expect(detail.groups.flatMap((g) => g.options).some((o) => o.name === 'Huevo')).toBe(false);
    const preview = await recipes.preview(detail.id, 4, initialChoices(detail.groups));
    expect(preview.per_serving?.kcal).toBeGreaterThan(0);
    const cooked = await recipes.cookNow(detail.id, detail.slots.includes('lunch') ? 'lunch' : detail.slots[0], 4, initialChoices(detail.groups));
    expect(cooked.plannedMealId).toBeTruthy();
    await recipes.rate(cooked.plannedMealId, 5, ['loved_repeat'], 'Rico');
  });

  it('8. plan: generar la semana, ver, presupuesto, cambiar, omitir, confirmar', async () => {
    planId = await plans.generate({ start: todayIso(), days: 7, slots: ['breakfast', 'lunch', 'dinner'] });
    const plan = (await plans.current(todayIso()))!;
    expect(plan.id).toBe(planId);
    expect(plan.meals.length).toBeGreaterThanOrEqual(20);
    expect(plan.meals.every((m) => m.recipeTitle.length > 0)).toBe(true);

    const budget = await plans.budget(planId);
    expect(budget.budgetLimit).toBe(150000);
    expect(budget.missingPrices).toBeGreaterThan(0);

    const meal = plan.meals.find((m) => m.status === 'planned' && m.slot === 'dinner')!;
    const [alternative] = await plans.alternatives(meal.slot, meal.recipeId);
    await plans.swap(meal.id, alternative.id, meal.recipeId);
    const other = plan.meals.find((m) => m.status === 'planned' && m.id !== meal.id)!;
    await plans.skip(other.id);
    const updated = (await plans.current(todayIso()))!;
    expect(updated.meals.find((m) => m.id === meal.id)?.recipeId).toBe(alternative.id);
    expect(updated.meals.find((m) => m.id === other.id)?.status).toBe('skipped');
    await plans.confirm(planId);
  });

  it('9. compras: armar la lista, marcar, pasar a la despensa, ítems manuales', async () => {
    const listId = await shopping.generate(planId);
    const list = (await shopping.forPlan(planId))!;
    expect(list.id).toBe(listId);
    expect(list.items.some((i) => i.name === 'Agua' || i.name === 'Sal')).toBe(false);
    const toBuy = list.items.find((i) => (i.toBuyGrams ?? 0) > 0 && i.ingredientId)!;
    await shopping.setChecked(toBuy.id, true);
    expect(await shopping.moveCheckedToPantry(listId)).toBe(1);
    await shopping.addManual(listId, 'Bolsas');
    const withManual = (await shopping.forPlan(planId))!;
    const manual = withManual.items.find((i) => i.name === 'Bolsas')!;
    await shopping.remove(manual.id);
    expect((await shopping.forPlan(planId))!.items.some((i) => i.name === 'Bolsas')).toBe(false);
  });

  it('10. exportar mis datos', async () => {
    const json = JSON.parse(await account.exportData());
    expect(json.allergens).toHaveLength(1);
    expect(json.meal_plans.length).toBeGreaterThan(0);
  });
});
