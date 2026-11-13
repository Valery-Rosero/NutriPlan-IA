import { renderHook, waitFor } from '@testing-library/react-native';

import { useRemovePantryItem } from '@/features/pantry/application/pantry-queries';
import { useCurrentPlan, useSkipMeal, useSwapMeal } from '@/features/plan/application/plan-queries';
import { useCookNow } from '@/features/recipes/application/recipe-queries';
import { fakePlans, fakeServices, fakeShopping, withServices } from '@/test/fakes';

/**
 * ADR-033 · "La cocina cambió": cualquier cambio a la despensa o al plan deja la lista de mercado al día, sin que la
 * persona tenga que tocar "Revisar de nuevo" (revisión de Mi cocina, C2).
 */
describe('la lista de mercado siempre está al día', () => {
  async function setup(services = fakeServices()) {
    const hook = await renderHook(
      () => ({ plan: useCurrentPlan(), remove: useRemovePantryItem(), swap: useSwapMeal(), skip: useSkipMeal(), cook: useCookNow('r1') }),
      { wrapper: withServices(services) },
    );
    return { services, hook };
  }

  it('al quitar algo de la despensa, la lista del plan se rehace', async () => {
    const { services, hook } = await setup();
    await waitFor(() => expect(hook.result.current.plan.data?.id).toBe('plan1'));
    await hook.result.current.remove.mutateAsync({ id: 'p1', ingredientId: 'papa' });
    await waitFor(() => expect(services.shopping.generate).toHaveBeenCalledWith('plan1'));
  });

  it('al cambiar u omitir una comida, también', async () => {
    const { services, hook } = await setup();
    await waitFor(() => expect(hook.result.current.plan.data?.id).toBe('plan1'));
    await hook.result.current.swap.mutateAsync({ mealId: 'm2', recipeId: 'r1', previousRecipeId: 'r2' });
    await waitFor(() => expect(services.shopping.generate).toHaveBeenCalledTimes(1));
    await hook.result.current.skip.mutateAsync('m2');
    await waitFor(() => expect(services.shopping.generate).toHaveBeenCalledTimes(2));
  });

  it('al cocinar (descuenta la despensa), también', async () => {
    const { services, hook } = await setup();
    await waitFor(() => expect(hook.result.current.plan.data?.id).toBe('plan1'));
    await hook.result.current.cook.mutateAsync({ slot: 'lunch', servings: 2, choices: [] });
    await waitFor(() => expect(services.shopping.generate).toHaveBeenCalledWith('plan1'));
  });

  it('sin plan no hay lista que rehacer; si rehacerla falla (sin conexión), lo demás se refresca igual', async () => {
    const noPlan = await setup(fakeServices({ plans: fakePlans({ current: jest.fn(async () => null) }) }));
    await waitFor(() => expect(noPlan.hook.result.current.plan.isSuccess).toBe(true));
    await noPlan.hook.result.current.remove.mutateAsync({ id: 'p1', ingredientId: 'papa' });
    expect(noPlan.services.shopping.generate).not.toHaveBeenCalled();

    const offline = await setup(fakeServices({ shopping: fakeShopping({ generate: jest.fn(async () => { throw new Error('offline'); }) }) }));
    await waitFor(() => expect(offline.hook.result.current.plan.data?.id).toBe('plan1'));
    await offline.hook.result.current.remove.mutateAsync({ id: 'p1', ingredientId: 'papa' });
    expect(offline.hook.result.current.remove.isError).toBe(false);
  });
});
