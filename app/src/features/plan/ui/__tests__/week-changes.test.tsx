import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AssistantScreen } from '@/features/assistant/ui/assistant-screen';
import { PlanScreen } from '@/features/plan/ui/plan-screen';
import { WeekChangesScreen } from '@/features/plan/ui/week-changes-screen';
import { fakeAssistant, fakePlans, fakeServices, PLAN, withServices } from '@/test/fakes';

describe('US-174 · Revisa los cambios a tu semana', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useLocalSearchParams).mockReturnValue({ goal: 'cheaper', avoid: 'lentejas', avoidNames: 'Lentejas secas' });
  });

  it('S-1/S-2: muestra antes → después con el porqué y el ahorro, sin cambiar todavía el plan', async () => {
    const services = fakeServices();
    await render(<WeekChangesScreen />, { wrapper: withServices(services) });

    expect(await screen.findByLabelText('Antes: Lentejas guisadas con lo que haya')).toBeOnTheScreen();
    expect(screen.getByLabelText('Después: Sopa de verduras del día')).toBeOnTheScreen();
    expect(services.plans.proposeWeekChanges).toHaveBeenCalledWith('plan1', 'cheaper', ['lentejas']);
    expect(screen.getAllByText('sin Lentejas secas').length).toBeGreaterThan(0);
    expect(screen.getByText('−$ 6.200')).toBeOnTheScreen();
    expect(screen.getByText('Con lo marcado ahorras $ 15.100')).toBeOnTheScreen();
    expect(services.plans.applyWeekChanges).not.toHaveBeenCalled();
  });

  it('S-2: si para una comida no hay con qué cambiarla sin lo que se evita, lo dice', async () => {
    await render(<WeekChangesScreen />, { wrapper: withServices(fakeServices()) });
    expect(await screen.findByText(/No encontré con qué cambiar Fríjoles con lo que haya/)).toBeOnTheScreen();
  });

  it('S-3: aplica solo lo marcado y rehace la lista de mercado', async () => {
    const services = fakeServices();
    await render(<WeekChangesScreen />, { wrapper: withServices(services) });

    const boxes = await screen.findAllByRole('checkbox');
    expect(boxes).toHaveLength(2);
    await fireEvent.press(boxes[1]); // desmarca el segundo
    expect(screen.getByText('Con lo marcado ahorras $ 6.200')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Aplicar 1 cambio' }));

    await waitFor(() => expect(services.plans.applyWeekChanges).toHaveBeenCalledWith('plan1', [{ plannedMealId: 'm1', recipeId: 'r7' }]));
    await waitFor(() => expect(services.shopping.generate).toHaveBeenCalledWith('plan1'));
    expect(await screen.findByText('Listo: cambiamos 1 comida. Tu lista de mercado ya está al día.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver mi semana' }));
    expect(useRouter().navigate).toHaveBeenCalledWith('/week');
  });

  it('se puede cambiar de meta ahí mismo; lo que se evita se mantiene', async () => {
    const services = fakeServices();
    await render(<WeekChangesScreen />, { wrapper: withServices(services) });
    await fireEvent.press(await screen.findByRole('radio', { name: 'Más rápida' }));
    await waitFor(() => expect(services.plans.proposeWeekChanges).toHaveBeenLastCalledWith('plan1', 'faster', ['lentejas']));
  });

  it('S-6: sin nada que mejorar, lo dice claro y no ofrece aplicar', async () => {
    const plans = fakePlans({ proposeWeekChanges: jest.fn(async () => []) });
    await render(<WeekChangesScreen />, { wrapper: withServices(fakeServices({ plans })) });
    expect(await screen.findByText(/No encontré cambios que mejoren tu semana/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Aplicar/ })).not.toBeOnTheScreen();
  });

  it('sin plan, pide organizar la semana primero', async () => {
    const plans = fakePlans({ current: jest.fn(async () => null) });
    await render(<WeekChangesScreen />, { wrapper: withServices(fakeServices({ plans })) });
    expect(await screen.findByText(/Primero organiza tu semana/)).toBeOnTheScreen();
    expect(plans.proposeWeekChanges).not.toHaveBeenCalled();
  });
});

describe('US-174 · Por dónde se llega', () => {
  beforeEach(() => jest.clearAllMocks());

  it('desde Mi semana: "Mejorar mi semana" con las metas a un toque', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    await render(<PlanScreen />, { wrapper: withServices(fakeServices()) });
    expect(await screen.findByRole('header', { name: 'Mejorar mi semana' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Más barata' }));
    expect(useRouter().push).toHaveBeenCalledWith({ pathname: '/plan/changes', params: { goal: 'cheaper' } });
  });

  it('desde el asistente: la tarjeta resume con las cifras de la base y abre los cambios', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    const assistant = fakeAssistant({
      send: jest.fn(async () => ({
        conversationId: 'c1', messageId: 9, fallback: false, suggestions: [], hasPlan: true,
        reply: '¡Claro! 💸\n\n**2 cambios** en tu semana · ahorras **$15.100**. Revísalos antes de aplicar.',
        week: { goal: 'cheaper' as const, avoid: [{ id: 'lentejas', name: 'Lentejas secas' }], changes: 2, saving: 15100, unresolved: 0 },
      })),
    });
    await render(<AssistantScreen />, { wrapper: withServices(fakeServices({ assistant })) });
    await fireEvent.changeText(screen.getByLabelText('Escribe tu pedido'), 'Hazme la semana más barata, sin lentejas');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByText('Cambios a tu semana')).toBeOnTheScreen();
    expect(screen.getAllByText('2 cambios')).toHaveLength(2); // en negrita en el mensaje y en la tarjeta
    expect(screen.getByText('ahorras $ 15.100')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver los cambios' }));
    expect(useRouter().push).toHaveBeenCalledWith({
      pathname: '/plan/changes',
      params: { goal: 'cheaper', avoid: 'lentejas', avoidNames: 'Lentejas secas' },
    });
  });

  it('S-7: sin IA, el asistente ofrece las metas de la semana como botones', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    const assistant = fakeAssistant({
      send: jest.fn(async () => ({
        conversationId: 'c1', messageId: 10, fallback: true, suggestions: [], hasPlan: true, week: null,
        reply: 'Te propongo **Sudado de lo que haya** (40 min), y tienes todo lo necesario.',
      })),
    });
    await render(<AssistantScreen />, { wrapper: withServices(fakeServices({ assistant })) });
    await fireEvent.changeText(screen.getByLabelText('Escribe tu pedido'), 'semana más rápida');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByText('¿Querías cambiar tu semana? Elige qué buscas:')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Más rápida' }));
    expect(useRouter().push).toHaveBeenCalledWith({ pathname: '/plan/changes', params: { goal: 'faster' } });
  });
});

// El plan de prueba debe tener comidas pendientes para que aparezca "Mejorar mi semana".
test('el plan de prueba tiene comidas pendientes', () => {
  expect(PLAN.meals.some((m) => m.status === 'planned')).toBe(true);
});
