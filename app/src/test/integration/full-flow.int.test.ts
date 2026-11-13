/**
 * Recorrido completo de una familia con los adaptadores REALES contra Supabase local (catálogo real cargado).
 * Verifica las consultas de verdad (PostgREST, RLS, RPC), no dobles. Variables: SUPABASE_URL y SUPABASE_ANON_KEY
 * (por defecto, las de `npx supabase start`).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { SupabaseAccountRepository } from '@/features/account/data/supabase-account-repository';
import { SupabaseAnalyticsRepository } from '@/features/analytics/data/supabase-analytics-repository';
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
import { SupabaseSpendingRepository } from '@/features/spending/data/supabase-spending-repository';
import { SupabaseSupportRepository } from '@/features/support/data/supabase-support-repository';
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
const spending = new SupabaseSpendingRepository(client);
const analytics = new SupabaseAnalyticsRepository(client, async () => '11111111-2222-4333-8444-555555555555', '1.0.0');
const support = new SupabaseSupportRepository(client, () => ({ appVersion: '1.0.0', deviceModel: 'Prueba' }));

const run = KEY ? describe : describe.skip;

run('recorrido completo contra Supabase real', () => {
  let eggId: number;
  let extraId = '';
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
    const quick = await pantry.findByNames(['Arroz blanco', 'Huevo']);
    expect(quick.map((i) => i.name).sort()).toEqual(['Arroz blanco', 'Huevo']);
    expect(quick.every((i) => (i.shelfLifeDays ?? 0) > 0)).toBe(true);
    const items = await pantry.list();
    expect(items.find((i) => i.name === 'Papa')?.grams).toBe(1000);
    expect(items.find((i) => i.name === 'Cerdo')?.grams).toBe(600);

    // B3b: un alimento propio (fuera del catálogo) convive con la despensa del catálogo
    await pantry.addCustom({ name: 'Galletas de la tienda', quantity: 2, unit: 'unit', expiresOn: null, foodGroupId: 9, storeCategoryId: 5 });
    await pantry.addCustom({ name: 'Bocadillo veleño', quantity: 250, unit: 'g', expiresOn: null, foodGroupId: null, storeCategoryId: null });
    const withCustom = await pantry.list();
    const galletas = withCustom.find((i) => i.name === 'Galletas de la tienda')!;
    expect(galletas).toMatchObject({ ingredientId: null, custom: { quantity: 2, unit: 'unit' } });
    expect(withCustom.find((i) => i.name === 'Papa')?.custom).toBeNull();
    await pantry.remove(galletas); // se borra de su tabla, no de la del catálogo
    const after = await pantry.list();
    expect(after.some((i) => i.name === 'Galletas de la tienda')).toBe(false);
    expect(after.some((i) => i.name === 'Papa')).toBe(true);
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
    // Sin plan, cocinar crea uno de un día solo con el adicional: Mi semana no lo muestra como plan.
    expect(await plans.current(todayIso())).toBeNull();
    extraId = cooked.plannedMealId;
  });

  it('8. plan: generar la semana, ver, presupuesto, cambiar, omitir, confirmar', async () => {
    planId = await plans.generate({ start: todayIso(), days: 7, slots: ['breakfast', 'lunch', 'dinner'] });
    const plan = (await plans.current(todayIso()))!;
    expect(plan.id).toBe(planId);
    expect(plan.meals.length).toBeGreaterThanOrEqual(21); // lo cocinado antes es un adicional: no ocupa el almuerzo
    expect(plan.meals.every((m) => m.recipeTitle.length > 0)).toBe(true);
    // El plato adicional de hoy sigue visible (aunque quedó en el borrador de un día, ahora archivado)
    expect(plan.extras.map((m) => m.id)).toEqual([extraId]);
    expect(plan.meals.some((m) => m.id === extraId)).toBe(false);

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
    // B3: lo manual entra con la sección que sugiere la clasificación (aquí, Lácteos y huevos = 3)
    await shopping.addManual(listId, 'Queso campesino', 3);
    const withManual = (await shopping.forPlan(planId))!;
    const manual = withManual.items.find((i) => i.name === 'Bolsas')!;
    expect(manual.categoryName).toBeNull(); // sin sección → "Otros"
    expect(withManual.items.find((i) => i.name === 'Queso campesino')?.categoryName).toBe('Lácteos y huevos');
    await shopping.remove(manual.id);
    expect((await shopping.forPlan(planId))!.items.some((i) => i.name === 'Bolsas')).toBe(false);

    // US-141: lo pagado suma al gasto del mes
    await spending.recordPurchase(45000, listId);
    const month = await spending.monthly();
    expect(month).toMatchObject({ spent: 45000, purchases: 1 });

    // US-152: los reemplazos sugeridos ahorran y cuadran exacto
    for (const s of await plans.savings(planId)) {
      expect(s.saving).toBe(s.currentCost - s.alternativeCost);
      expect(s.saving).toBeGreaterThanOrEqual(500);
    }
  });

  it('10. reportar un problema con captura (US-151): la captura queda en la carpeta propia', async () => {
    // PNG de 1×1 como data URI: fetch lo lee igual que un archivo local del teléfono.
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    await support.send({ category: 'bug', message: 'La lista no carga', screenshot: { uri: png, mimeType: 'image/png' } });
    const { data: tickets } = await client.from('support_tickets').select('message, app_version, device_model, screenshot_path');
    const userId = (await client.auth.getSession()).data.session!.user.id;
    expect(tickets).toEqual([
      expect.objectContaining({ message: 'La lista no carga', app_version: '1.0.0', device_model: 'Prueba' }),
    ]);
    expect(tickets![0].screenshot_path).toMatch(new RegExp(`^${userId}/\\d+\\.png$`));
    const { data: files } = await client.storage.from('support-screenshots').list(userId);
    expect(files).toHaveLength(1);
  });

  it('11. analítica anónima (US-131): se registra; apagada, la base la rechaza sin romper nada', async () => {
    await analytics.track('plan_generated');
    await profile.updateProfile({ analyticsEnabled: false });
    await expect(analytics.track('meal_cooked')).resolves.toBeUndefined();
    await profile.updateProfile({ analyticsEnabled: true });
    // los usuarios no pueden leer la analítica (ni siquiera la suya): solo el equipo
    const { data } = await client.from('analytics_events').select('id');
    expect(data ?? []).toHaveLength(0);
  });

  it('12. reportar una falla (US-122): se registra limpia y nadie la puede leer desde la app', async () => {
    const { error } = await client.rpc('report_app_error', {
      p_error_name: 'TypeError',
      p_message: 'falló para ana@correo.com',
      p_screen: 'Hoy',
      p_anonymous_id: '11111111-2222-4333-8444-555555555555',
    });
    expect(error).toBeNull();
    const { data, error: readError } = await client.from('app_errors').select('message');
    expect(data ?? []).toHaveLength(0);
    expect(readError).not.toBeNull(); // sin permiso de lectura
  });

  it('13. exportar mis datos', async () => {
    const json = JSON.parse(await account.exportData());
    expect(json.allergens).toHaveLength(1);
    expect(json.meal_plans.length).toBeGreaterThan(0);
    expect(json.support_tickets).toHaveLength(1);
    expect(json.pantry_custom.map((i: { name: string }) => i.name)).toEqual(['Bocadillo veleño']); // B3b
  });
});
