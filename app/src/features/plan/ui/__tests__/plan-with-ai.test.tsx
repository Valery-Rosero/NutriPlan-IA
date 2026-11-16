import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { AppError } from '@/core/errors/app-error';
import { PlanScreen } from '@/features/plan/ui/plan-screen';
import { fakePlans, fakeServices, PLAN, withServices } from '@/test/fakes';

/** ADR-039 · semana y mes con IA (propuesta aprobada: https://claude.ai/artifact/8zR7xTtTTrtsCwY6iDTK9Z). */
describe('Planear con IA', () => {
  beforeEach(() => jest.clearAllMocks());

  it('S-1/S-3: platos → recetas de a 4 en paralelo → guardar; el plan dice "Hecho con IA"', async () => {
    let created = false;
    const plans = fakePlans({
      current: jest.fn(async () => (created ? { ...PLAN, createdWithAi: true } : null)),
      aiSave: jest.fn(async () => {
        created = true;
        return 'plan-ia';
      }),
    });
    const services = fakeServices({ plans });
    await render(<PlanScreen />, { wrapper: withServices(services) });

    await fireEvent.press(await screen.findByRole('button', { name: 'Planear la semana con IA' }));
    await waitFor(() => expect(plans.aiSave).toHaveBeenCalled());
    expect(plans.aiMenu).toHaveBeenCalledWith(7, ['breakfast', 'lunch', 'dinner']);
    expect(plans.aiRecipes).toHaveBeenCalledTimes(2); // 5 platos: 4 + 1
    expect(jest.mocked(plans.aiSave).mock.calls[0][1]).toHaveLength(5);
    expect(plans.generate).not.toHaveBeenCalled(); // no hubo que usar el recetario
    expect(await screen.findByText('Hecho con IA')).toBeOnTheScreen();
  });

  it('muestra el avance real mientras arma', async () => {
    let finishMenu: (v: never) => void = () => undefined;
    const plans = fakePlans({ current: jest.fn(async () => null), aiMenu: jest.fn(() => new Promise((resolve) => { finishMenu = resolve as never; })) });
    await render(<PlanScreen />, { wrapper: withServices(fakeServices({ plans })) });
    await fireEvent.press(await screen.findByRole('button', { name: 'Planear la semana con IA' }));
    expect(await screen.findByText('Armando tu plan con IA…')).toBeOnTheScreen();
    expect(screen.getByText('Pensando platos para ti')).toBeOnTheScreen();
    expect(screen.getByText('Puedes ir a otra pestaña: sigo trabajando.')).toBeOnTheScreen();
    finishMenu([] as never);
  });

  it('S-6: si la IA no responde, el plan sale del recetario y lo dice', async () => {
    const plans = fakePlans({ current: jest.fn(async () => null), aiMenu: jest.fn(async () => { throw new AppError('ai_unavailable'); }) });
    await render(<PlanScreen />, { wrapper: withServices(fakeServices({ plans })) });
    await fireEvent.press(await screen.findByRole('button', { name: 'Planear la semana con IA' }));
    await waitFor(() => expect(plans.generate).toHaveBeenCalledWith(expect.objectContaining({ days: 7 })));
    expect(await screen.findByText('La IA no respondió a tiempo: armé tu plan con el recetario.')).toBeOnTheScreen();
  });

  it('si la base no acepta casi ninguna receta, también sale del recetario', async () => {
    const plans = fakePlans({
      current: jest.fn(async () => null),
      aiRecipes: jest.fn(async (_s: unknown, dishes: { title: string; kind: 'breakfast' | 'main' }[]) =>
        dishes.map((d) => ({ title: d.title, recipeId: null, kind: d.kind, expiring: false, coverage: 0 }))),
    });
    await render(<PlanScreen />, { wrapper: withServices(fakeServices({ plans })) });
    await fireEvent.press(await screen.findByRole('button', { name: 'Planear la semana con IA' }));
    await waitFor(() => expect(plans.generate).toHaveBeenCalled());
    expect(plans.aiSave).not.toHaveBeenCalled();
  });

  it('con los 3 planes con IA del día ya usados, sale del recetario y explica por qué', async () => {
    const plans = fakePlans({ current: jest.fn(async () => null), aiMenu: jest.fn(async () => { throw new AppError('quota_exceeded'); }) });
    await render(<PlanScreen />, { wrapper: withServices(fakeServices({ plans })) });
    await fireEvent.press(await screen.findByRole('button', { name: 'Planear la semana con IA' }));
    expect(await screen.findByText(/Ya hiciste 3 planes con IA hoy/)).toBeOnTheScreen();
  });

  it('una comida pensada por la IA dice por qué', async () => {
    const plans = fakePlans({
      current: jest.fn(async () => ({ ...PLAN, createdWithAi: true, meals: PLAN.meals.map((m) => ({ ...m, reasonCode: 'ai_pick' })) })),
    });
    await render(<PlanScreen />, { wrapper: withServices(fakeServices({ plans })) });
    expect((await screen.findAllByText('Plato pensado por la IA para ti')).length).toBeGreaterThan(0);
  });
});
