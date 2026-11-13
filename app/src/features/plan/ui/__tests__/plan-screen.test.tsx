import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { PlanScreen } from '@/features/plan/ui/plan-screen';
import { fakePlans, fakeServices, PLAN, withServices } from '@/test/fakes';

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

  it('US-152: si se pasa del presupuesto, "Ajustar automáticamente" propone cambios con el ahorro exacto', async () => {
    const plans = fakePlans();
    await render(<PlanScreen />, { wrapper: withServices(fakeServices({ plans })) });

    await fireEvent.press(await screen.findByRole('button', { name: 'Ajustar automáticamente' }));
    expect(await screen.findByText('Cambiar Arroz salteado con lo que tengas por Crema de ahuyama')).toBeOnTheScreen();
    expect(screen.getByText('Ahorras $ 5.000')).toBeOnTheScreen();
    expect(screen.getByText('Ahorras $ 5.100')).toBeOnTheScreen();

    await fireEvent.press(screen.getAllByRole('button', { name: 'Aceptar' })[0]);
    await waitFor(() => expect(plans.swap).toHaveBeenCalledWith('m1', 'r9', 'r1', 'budget_friendly'));
    // al aceptar se recalcula el total
    await waitFor(() => expect(plans.budget.mock.calls.length).toBeGreaterThan(1));
  });

  it('US-141: muestra el gasto del mes frente al presupuesto', async () => {
    await render(<PlanScreen />, { wrapper: withServices(fakeServices()) });
    expect(await screen.findByText('64 % — $ 38.200 de $ 60.000')).toBeOnTheScreen();
  });

  describe('B1: calendario como libro', () => {
    it('plan de una semana: tira de 7 días; tocar un día lo abre en su página', async () => {
      await render(<PlanScreen />, { wrapper: withServices(fakeServices()) });
      const days = await screen.findAllByRole('tab');
      expect(days).toHaveLength(7);
      const tuesday13 = screen.getByRole('tab', { name: /^Martes, 13 de octubre/ });
      await fireEvent.press(tuesday13);
      expect(screen.getByRole('tab', { name: /^Martes, 13 de octubre/ })).toBeSelected();
      expect(screen.getByRole('tab', { name: /^Martes, 13 de octubre.*Comidas pendientes/ })).toBeOnTheScreen();
    });

    it('cada página tiene "día anterior" y "día siguiente" (sin tener que deslizar)', async () => {
      await render(<PlanScreen />, { wrapper: withServices(fakeServices()) });
      // el plan de prueba ya pasó: abre en el último día, que no tiene comidas
      expect((await screen.findAllByText('No hay comidas planeadas este día.')).length).toBeGreaterThan(0);
      const prev = screen.getAllByRole('button', { name: 'Día anterior' });
      expect(prev[0]).toBeDisabled(); // la primera página no tiene anterior
      await fireEvent.press(prev[prev.length - 1]);
      expect(screen.getByRole('tab', { name: /^Domingo, 18 de octubre/ })).toBeSelected();
    });

    it('plan de más de 7 días: cuadrícula del mes, con los días fuera del plan apagados', async () => {
      const plans = fakePlans({ current: jest.fn(async () => ({ ...PLAN, endDate: '2026-11-01' })) });
      await render(<PlanScreen />, { wrapper: withServices(fakeServices({ plans })) });
      const tabs = await screen.findAllByRole('tab');
      expect(tabs.length % 7).toBe(0); // semanas completas de lunes a domingo
      expect(screen.getByRole('tab', { name: /^Lunes, 12 de octubre/ })).toBeDisabled(); // antes del plan
      expect(screen.getByRole('tab', { name: /^Domingo, 1 de noviembre/ })).toBeEnabled();
    });
  });
});
