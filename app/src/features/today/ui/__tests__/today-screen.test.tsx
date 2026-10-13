import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { KitchenScreen } from '@/features/kitchen/ui/kitchen-screen';
import { todayIso } from '@/features/pantry/domain/pantry';
import { TodayScreen } from '@/features/today/ui/today-screen';
import { fakePantry, fakePlans, fakeServices, fakeShopping, PLAN, withServices } from '@/test/fakes';

const kitchenWith = (names: string[]) =>
  fakePantry({ list: jest.fn(async () => names.map((name) => ({ id: name, ingredientId: name, name, grams: 500, expiresOn: null }))) });

describe('Hoy (ADR-024): el flujo gira en torno a la cocina', () => {
  beforeEach(() => jest.clearAllMocks());

  it('con la cocina vacía, pregunta qué hay y lo agrega con un toque', async () => {
    const pantry = fakePantry();
    await render(<TodayScreen />, { wrapper: withServices(fakeServices({ pantry, plans: fakePlans({ current: jest.fn(async () => null) }) })) });
    expect(await screen.findByText('¿Qué hay en tu cocina?')).toBeOnTheScreen();

    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Arroz blanco' }));
    await waitFor(() =>
      expect(pantry.add).toHaveBeenCalledWith(expect.objectContaining({ ingredientId: 'Arroz blanco', quantity: 1, unitId: 2 })),
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
    await render(<TodayScreen />, { wrapper: withServices(fakeServices({ plans, shopping, pantry: kitchenWith(['Papa']) })) });

    await fireEvent.press(await screen.findByRole('button', { name: 'Organizar mi semana' }));
    await waitFor(() => expect(shopping.generate).toHaveBeenCalledWith('plan1'));
    expect(plans.generate).toHaveBeenCalledWith(expect.objectContaining({ days: 7 }));
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
