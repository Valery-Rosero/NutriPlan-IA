import { fireEvent, render, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { RecipeScreen } from '@/features/recipes/ui/recipe-screen';
import { fakeRecipes, fakeServices, withServices } from '@/test/fakes';

describe('RecipeScreen (US-115, US-118, US-123, ADR-020)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'r1' });
  });

  it('muestra la opción que hay en casa, las cantidades y la nutrición calculadas por el servidor', async () => {
    const recipes = fakeRecipes();
    await render(<RecipeScreen />, { wrapper: withServices(fakeServices({ recipes })) });

    expect(await screen.findByText('Arroz salteado con lo que tengas')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Cerdo · lo tienes' })).toBeSelected();
    expect(await screen.findByText('420 kcal')).toBeOnTheScreen();
    // porciones = tamaño del hogar (4) y la opción resuelta con la despensa (cerdo)
    expect(recipes.preview).toHaveBeenCalledWith('r1', 4, [{ groupKey: 1, ingredientId: 'cerdo' }]);
  });

  it('cambiar de opción y de porciones vuelve a calcular en el servidor', async () => {
    const recipes = fakeRecipes();
    await render(<RecipeScreen />, { wrapper: withServices(fakeServices({ recipes })) });
    await fireEvent.press(await screen.findByRole('radio', { name: 'Pechuga de pollo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Aumentar: Porciones' }));

    await screen.findByText('420 kcal');
    expect(recipes.preview).toHaveBeenLastCalledWith('r1', 5, [{ groupKey: 1, ingredientId: 'pollo' }]);
  });

  it('cocinar ahora descuenta, informa lo que faltó y permite deshacer', async () => {
    const recipes = fakeRecipes();
    await render(<RecipeScreen />, { wrapper: withServices(fakeServices({ recipes })) });
    await fireEvent.press(await screen.findByRole('button', { name: 'Cocinar ahora' }));

    expect(await screen.findByText('¡Buen provecho!')).toBeOnTheScreen();
    expect(screen.getByText('• Arroz blanco: 300 g')).toBeOnTheScreen();
    expect(recipes.cookNow).toHaveBeenCalledWith('r1', expect.stringMatching(/lunch|dinner/), 4, [{ groupKey: 1, ingredientId: 'cerdo' }]);

    await fireEvent.press(screen.getByRole('button', { name: /Deshacer/ }));
    expect(recipes.undoCook).toHaveBeenCalledWith('pm1');
  });
});
