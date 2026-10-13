import { fireEvent, render, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { PlanScreen } from '@/features/plan/ui/plan-screen';
import { fakePlans, fakeServices, withServices } from '@/test/fakes';

describe('PlanScreen (US-117, US-129, US-132, US-155)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sin plan ofrece generarlo para la semana o solo para hoy', async () => {
    const plans = fakePlans({ current: jest.fn(async () => null) });
    await render(<PlanScreen />, { wrapper: withServices(fakeServices({ plans })) });
    await fireEvent.press(await screen.findByRole('button', { name: 'Solo para hoy' }));
    expect(plans.generate).toHaveBeenCalledWith(expect.objectContaining({ days: 1, slots: ['breakfast', 'lunch', 'dinner'] }));
  });

  it('muestra las comidas con su motivo y alerta si el plan se pasa del presupuesto', async () => {
    await render(<PlanScreen />, { wrapper: withServices(fakeServices()) });
    expect(await screen.findByText('Arroz salteado con lo que tengas')).toBeOnTheScreen();
    expect(screen.getByText('Usa algo de tu despensa que vence pronto')).toBeOnTheScreen();
    expect(await screen.findByText('Te pasas del presupuesto por $ 10.000. Prueba cambiar algunas comidas.')).toBeOnTheScreen();
    expect(screen.getByText('Falta el precio de 12 ingredientes: el costo real será mayor.')).toBeOnTheScreen();
  });

  it('cambiar abre las alternativas para ese momento del día; abrir la receta lleva la comida del plan', async () => {
    await render(<PlanScreen />, { wrapper: withServices(fakeServices()) });
    const swaps = await screen.findAllByRole('link', { name: 'Cambiar' });
    await fireEvent.press(swaps[0]);
    expect(useRouter().push).toHaveBeenCalledWith({ pathname: '/plan/swap/[mealId]', params: { mealId: 'm1', slot: 'lunch', recipeId: 'r1' } });

    await fireEvent.press(screen.getByRole('link', { name: 'Arroz salteado con lo que tengas' }));
    expect(useRouter().push).toHaveBeenCalledWith({ pathname: '/recipe/[id]', params: { id: 'r1', mealId: 'm1', servings: '4' } });
  });

  it('confirmar el plan', async () => {
    const plans = fakePlans();
    await render(<PlanScreen />, { wrapper: withServices(fakeServices({ plans })) });
    await fireEvent.press(await screen.findByRole('button', { name: 'Confirmar plan' }));
    expect(plans.confirm).toHaveBeenCalledWith('plan1');
  });
});
