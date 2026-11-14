import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { KitchenScreen } from '@/features/kitchen/ui/kitchen-screen';
import { todayIso } from '@/features/pantry/domain/pantry';
import { TodayScreen } from '@/features/today/ui/today-screen';
import { fakePantry, fakePlans, fakeProfile, fakeServices, fakeShopping, PLAN, PROFILE, withServices } from '@/test/fakes';

const kitchenWith = (names: string[]) =>
  fakePantry({ list: jest.fn(async () => names.map((name) => ({ id: name, ingredientId: name, name, grams: 500, expiresOn: null, custom: null }))) });

describe('Hoy (ADR-024): el flujo gira en torno a la cocina', () => {
  beforeEach(() => jest.clearAllMocks());

  it('con la cocina vacía, pregunta qué hay y lo agrega con un toque', async () => {
    const pantry = fakePantry();
    await render(<TodayScreen />, { wrapper: withServices(fakeServices({ pantry, plans: fakePlans({ current: jest.fn(async () => null) }) })) });
    expect(await screen.findByText('¿Qué hay en tu cocina?')).toBeOnTheScreen();

    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Arroz blanco' }));
    await waitFor(() =>
      expect(pantry.add).toHaveBeenCalledWith(expect.objectContaining({ ingredientId: 'arroz', quantity: 1, unitId: 2 })),
    );
  });

  it('muestra lo planeado para hoy y lleva a la receta de esa comida', async () => {
    const plans = fakePlans({ current: jest.fn(async () => ({ ...PLAN, meals: PLAN.meals.map((m) => ({ ...m, date: todayIso() })) })) });
    await render(<TodayScreen />, { wrapper: withServices(fakeServices({ plans, pantry: kitchenWith(['Papa']) })) });

    expect(await screen.findByText('Lo que planeaste para hoy')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'Arroz salteado con lo que tengas' }));
    expect(useRouter().push).toHaveBeenCalledWith({ pathname: '/recipe/[id]', params: { id: 'r1', mealId: 'm1', servings: '4' } });
    expect(screen.getByText('Tienes 1 ingrediente registrado.')).toBeOnTheScreen();
  });

  it('organizar la semana genera el plan Y la lista de mercado', async () => {
    const plans = fakePlans({ current: jest.fn(async () => null) });
    const shopping = fakeShopping();
    const services = fakeServices({ plans, shopping, pantry: kitchenWith(['Papa']) });
    await render(<TodayScreen />, { wrapper: withServices(services) });

    await fireEvent.press(await screen.findByRole('button', { name: 'Organizar mi semana' }));
    await waitFor(() => expect(shopping.generate).toHaveBeenCalledWith('plan1'));
    expect(plans.generate).toHaveBeenCalledWith(expect.objectContaining({ days: 7 }));
    // US-131: eventos anónimos de uso (sin datos de la persona)
    await waitFor(() => expect(services.analytics.track).toHaveBeenCalledWith('plan_generated'));
    expect(services.analytics.track).toHaveBeenCalledWith('shopping_list_generated');
  });
});

describe('Hoy "Cocina viva": la pregunta del momento y el plato al frente', () => {
  afterEach(() => jest.restoreAllMocks());

  const idea = (recipeId: string, title: string, extra = {}) => ({
    recipeId, title, totalMinutes: 25, coverage: 0.9, missing: [{ ingredientId: 'i9', name: 'Cebolla', missingGrams: 50 }], usesExpiring: false, ...extra,
  });

  it('a la hora de la cena pregunta "para la cena" (concordancia por momento)', async () => {
    jest.spyOn(Date.prototype, 'getHours').mockReturnValue(19);
    await render(<TodayScreen />, { wrapper: withServices(fakeServices({ pantry: kitchenWith(['Papa']) })) });
    expect(await screen.findByRole('header', { name: '¿Qué cocinamos para la cena?' })).toBeOnTheScreen();
  });

  it('resume la cocina en píldoras: cuántos ingredientes y cuántos vencen pronto', async () => {
    const soon = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const pantry = fakePantry({
      list: jest.fn(async () => [
        { id: 'a', ingredientId: 'a', name: 'Espinaca', grams: 300, expiresOn: soon, custom: null },
        { id: 'b', ingredientId: 'b', name: 'Papa', grams: 1000, expiresOn: null, custom: null },
      ]),
    });
    await render(<TodayScreen />, { wrapper: withServices(fakeServices({ pantry })) });
    expect(await screen.findByText('2 ingredientes')).toBeOnTheScreen();
    expect(screen.getByText('1 vence pronto')).toBeOnTheScreen();
  });

  it('la mejor idea sale en grande con su botón; las demás, como tarjetas que abren la receta', async () => {
    const cooking = { suggestions: jest.fn(async () => [idea('r1', 'Arroz salteado con lo que tengas'), idea('r2', 'Batido de fruta', { missing: [] })]) };
    await render(<TodayScreen />, { wrapper: withServices({ ...fakeServices({ pantry: kitchenWith(['Papa']) }), cooking }) });

    await fireEvent.press(await screen.findByRole('button', { name: 'Quiero cocinar esta' }));
    expect(useRouter().push).toHaveBeenCalledWith({ pathname: '/recipe/[id]', params: { id: 'r1' } });
    expect(screen.getAllByText('Tienes el 90 % de los ingredientes')[0]).toBeOnTheScreen();
    expect(screen.getAllByText('Te falta: Cebolla')[0]).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: /^Batido de fruta\./ }));
    expect(useRouter().push).toHaveBeenCalledWith({ pathname: '/recipe/[id]', params: { id: 'r2' } });
  });
});

describe('Mi día (US-159)', () => {
  it('suma solo lo cocinado y muestra lo que falta como pendiente', async () => {
    await render(<TodayScreen />, { wrapper: withServices(fakeServices({ pantry: kitchenWith(['Papa']) })) });
    expect(await screen.findByText('1000 kcal cocinadas hoy')).toBeOnTheScreen();
    expect(screen.getByText('Cuentan 2 comidas cocinadas (por porción).')).toBeOnTheScreen();
    expect(screen.getByText('Cena: pendiente')).toBeOnTheScreen();
  });

  it('con meta, muestra el avance frente a ella', async () => {
    const profile = fakeProfile({ getProfile: jest.fn(async () => ({ ...PROFILE, dailyKcalTarget: 2000 })) });
    await render(<TodayScreen />, { wrapper: withServices(fakeServices({ profile, pantry: kitchenWith(['Papa']) })) });
    expect(await screen.findByText('1000 de 2000 kcal')).toBeOnTheScreen();
  });
});

describe('Mi cocina: lo que tengo y la lista de mercado en un solo lugar', () => {
  it('abre "lo que tengo" y cambia a la lista desde la ruta', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    await render(<KitchenScreen />, { wrapper: withServices(fakeServices({ pantry: kitchenWith(['Papa']) })) });
    expect(await screen.findByText('Papa')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Lista de mercado' }));
    expect(useRouter().setParams).toHaveBeenCalledWith({ tab: 'list' });
  });

  it('con ?tab=list muestra la lista de mercado', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ tab: 'list' });
    await render(<KitchenScreen />, { wrapper: withServices(fakeServices()) });
    expect(await screen.findByText('0 de 3 comprados')).toBeOnTheScreen();
  });
});
