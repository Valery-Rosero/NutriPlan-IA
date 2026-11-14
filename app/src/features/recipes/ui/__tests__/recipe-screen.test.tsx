import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { RecipeScreen } from '@/features/recipes/ui/recipe-screen';
import { fakePlans, fakeRecipes, fakeServices, RECIPE, withServices } from '@/test/fakes';

describe('RecipeScreen (US-115, US-118, US-123, ADR-020)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'r1' });
  });

  it('muestra la opción que hay en casa, las cantidades y la nutrición calculadas por el servidor', async () => {
    const recipes = fakeRecipes();
    await render(<RecipeScreen />, { wrapper: withServices(fakeServices({ recipes })) });

    expect(await screen.findByText('Arroz salteado con lo que tengas')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Cerdo' })).toBeSelected();
    expect(await screen.findByText('420 kcal')).toBeOnTheScreen();
    // porciones = tamaño del hogar (4) y la opción resuelta con la despensa (cerdo)
    expect(recipes.preview).toHaveBeenCalledWith('r1', 4, [{ groupKey: 1, ingredientId: 'cerdo' }]);
  });

  it('las opciones se dividen en "En tu cocina" y "Para comprar"', async () => {
    await render(<RecipeScreen />, { wrapper: withServices(fakeServices()) });
    expect(await screen.findByText('En tu cocina')).toBeOnTheScreen();
    expect(screen.getByText('Para comprar')).toBeOnTheScreen();
    // Cerdo (lo tienes) va antes que Pechuga de pollo (para comprar)
    const radios = screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel);
    expect(radios.indexOf('Cerdo')).toBeLessThan(radios.indexOf('Pechuga de pollo'));
  });

  it('lo elegido se puede quitar; si el grupo queda vacío, avisa y no deja cocinar hasta elegir', async () => {
    await render(<RecipeScreen />, { wrapper: withServices(fakeServices()) });
    const cerdo = await screen.findByRole('radio', { name: 'Cerdo' });
    expect(cerdo.props.accessibilityHint).toBe('Toca para quitar'); // la ✕ se anuncia al lector de pantalla
    await fireEvent.press(cerdo);
    expect(screen.getByRole('radio', { name: 'Cerdo' })).not.toBeSelected();
    expect(screen.getByText('Elige al menos 1 opción de Proteína.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cocinar ahora' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('radio', { name: 'Pechuga de pollo' }));
    expect(screen.queryByText('Elige al menos 1 opción de Proteína.')).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cocinar ahora' })).toBeEnabled();
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
    const services = fakeServices({ recipes });
    await render(<RecipeScreen />, { wrapper: withServices(services) });
    await fireEvent.press(await screen.findByRole('button', { name: 'Cocinar ahora' }));

    expect(await screen.findByText('¡Buen provecho!')).toBeOnTheScreen();
    expect(screen.getByText('• Arroz blanco: 300 g')).toBeOnTheScreen();
    expect(recipes.cookNow).toHaveBeenCalledWith('r1', expect.stringMatching(/lunch|dinner/), 4, [{ groupKey: 1, ingredientId: 'cerdo' }]);

    await fireEvent.press(screen.getByRole('button', { name: /Deshacer/ }));
    expect(recipes.undoCook).toHaveBeenCalledWith('pm1');
    expect(services.analytics.track).toHaveBeenCalledWith('meal_cooked');
  });

  it('US-147: para lo que falta, sugiere con qué reemplazarlo y marca lo que ya tienes', async () => {
    const recipes = fakeRecipes();
    await render(<RecipeScreen />, { wrapper: withServices(fakeServices({ recipes })) });

    expect(await screen.findByText('Puedes usar: Papa (lo tienes)')).toBeOnTheScreen();
    // solo se consultan los ingredientes que faltan (el cerdo ya está en la cocina)
    expect(recipes.substitutes).toHaveBeenCalledWith(['arroz']);
  });

  it('ADR-029/033: lo que falta va a la lista como ingrediente con sus gramos (al comprarlo llega a la despensa)', async () => {
    const services = fakeServices();
    await render(<RecipeScreen />, { wrapper: withServices(services) });

    await fireEvent.press(await screen.findByRole('button', { name: 'Agregar lo que falta a mi lista (1)' }));
    await waitFor(() => expect(services.shopping.addIngredients).toHaveBeenCalledWith('list1', [{ ingredientId: 'arroz', grams: 300 }]));
    expect(await screen.findByText('Listo, quedó en tu lista de mercado.')).toBeOnTheScreen();
  });

  it('A1 (ADR-035): sin plan, lo que falta va a la lista de la casa', async () => {
    const services = fakeServices({ plans: fakePlans({ current: jest.fn(async () => null) }) });
    await render(<RecipeScreen />, { wrapper: withServices(services) });
    await fireEvent.press(await screen.findByRole('button', { name: 'Agregar lo que falta a mi lista (1)' }));
    await waitFor(() => expect(services.shopping.addIngredients).toHaveBeenCalledWith('house1', [{ ingredientId: 'arroz', grams: 300 }]));
  });

  it('con plan pero sin lista armada todavía, la arma y agrega', async () => {
    const services = fakeServices();
    jest.mocked(services.shopping.forPlan).mockResolvedValue(null);
    await render(<RecipeScreen />, { wrapper: withServices(services) });
    await fireEvent.press(await screen.findByRole('button', { name: 'Agregar lo que falta a mi lista (1)' }));
    await waitFor(() => expect(services.shopping.generate).toHaveBeenCalledWith('plan1'));
    expect(services.shopping.addIngredients).toHaveBeenCalledWith('list1', [{ ingredientId: 'arroz', grams: 300 }]);
  });

  it('una receta creada por el asistente lo dice', async () => {
    const recipes = fakeRecipes({ getDetail: jest.fn(async () => ({ ...RECIPE, byAssistant: true })) });
    await render(<RecipeScreen />, { wrapper: withServices(fakeServices({ recipes })) });
    expect(await screen.findByText(/Receta creada por el asistente/)).toBeOnTheScreen();
  });
});
