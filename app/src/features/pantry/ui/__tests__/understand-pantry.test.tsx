import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { addDays, todayIso } from '@/features/pantry/domain/pantry';
import { AddPantryItemScreen } from '@/features/pantry/ui/add-pantry-item-screen';
import { PantryScreen } from '@/features/pantry/ui/pantry-screen';
import { fakePantry, fakeServices, withServices } from '@/test/fakes';

async function understand(services: ReturnType<typeof fakeServices>) {
  await render(<AddPantryItemScreen />, { wrapper: withServices(services) });
  await fireEvent.press(await screen.findByRole('radio', { name: 'Escribir' }));
  // A4 (ADR-036): un camino a la vez; la búsqueda del catálogo no se apila debajo.
  expect(screen.queryByLabelText('¿Qué tienes?')).not.toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText('Lo que compraste o tienes'), '2 libras de papa criolla y un queso crema');
  await fireEvent.press(screen.getByRole('button', { name: 'Entender' }));
  await screen.findByRole('header', { name: 'Revisa lo que entendí' });
}

describe('ADR-030 · "Escríbelo como lo dirías"', () => {
  beforeEach(() => jest.clearAllMocks());

  it('la IA separa lo escrito; nada se guarda hasta revisar, y se guarda solo lo marcado', async () => {
    const services = fakeServices();
    await understand(services);
    expect(services.pantry.understand).toHaveBeenCalledWith('2 libras de papa criolla y un queso crema');
    expect(services.pantry.add).not.toHaveBeenCalled();
    // La búsqueda del catálogo se esconde mientras se revisa.
    expect(screen.queryByLabelText('¿Qué tienes?')).not.toBeOnTheScreen();

    expect(screen.getByRole('checkbox', { name: 'Papa criolla' })).toBeChecked();
    expect(screen.getByText('vence en 15 días')).toBeOnTheScreen();
    expect(screen.getByText('Propio')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Queso crema' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar 1 cosa' }));

    await waitFor(() =>
      expect(services.pantry.add).toHaveBeenCalledWith({ ingredientId: 'criolla', quantity: 2, unitId: 3, expiresOn: addDays(todayIso(), 15) }),
    );
    expect(services.pantry.addCustom).not.toHaveBeenCalled();
    expect(useRouter().back).toHaveBeenCalled();
  });

  it('se puede corregir la cantidad; lo que no está en el catálogo se guarda como propio, clasificado', async () => {
    const services = fakeServices();
    await understand(services);
    const [, quesoQty] = screen.getAllByLabelText('Cantidad');
    await fireEvent.changeText(quesoQty, '1,5');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar 2 cosas' }));

    await waitFor(() =>
      expect(services.pantry.addCustom).toHaveBeenCalledWith({
        name: 'Queso crema', quantity: 1.5, unit: 'unit', expiresOn: addDays(todayIso(), 10), foodGroupId: 16, storeCategoryId: 3,
      }),
    );
    expect(services.foodLabels.classify).toHaveBeenCalledWith('Queso crema');
  });

  it('sin IA (reglas) lo avisa para que se revise con cuidado', async () => {
    const pantry = fakePantry({
      understand: jest.fn(async () => ({ source: 'rules' as const, items: [{ ingredientId: 'papa', name: 'Papa', quantity: 1, unit: 'unit', units: ['unit', 'g'], expiresInDays: null }] })),
    });
    await understand(fakeServices({ pantry }));
    expect(screen.getByText(/Lo entendí sin la IA/)).toBeOnTheScreen();
    expect(screen.getByText('sin fecha')).toBeOnTheScreen();
  });
});

describe('ADR-030 · "Para completar más recetas"', () => {
  beforeEach(() => jest.clearAllMocks());

  it('dice qué comprar y qué recetas completa, y lo agrega a la lista', async () => {
    const pantry = fakePantry({
      list: jest.fn(async () => [{ id: 'p1', ingredientId: 'papa', name: 'Papa', grams: 1000, expiresOn: null, custom: null }]),
    });
    const services = fakeServices({ pantry });
    await render(<PantryScreen />, { wrapper: withServices(services) });

    expect(await screen.findByRole('header', { name: 'Para completar más recetas' })).toBeOnTheScreen();
    expect(screen.getByText('Completa 2 recetas: Sudado de lo que haya, Arroz salteado con lo que tengas')).toBeOnTheScreen();
    await fireEvent.press(await screen.findByRole('button', { name: 'Agregar a mi lista' }));
    await waitFor(() => expect(services.shopping.addIngredients).toHaveBeenCalledWith('list1', [{ ingredientId: 'cebolla', grams: 120 }]));
    expect(await screen.findByText('Listo, en tu lista de mercado.')).toBeOnTheScreen();
  });

  it('sin sugerencias no ocupa espacio', async () => {
    const pantry = fakePantry({
      list: jest.fn(async () => [{ id: 'p1', ingredientId: 'papa', name: 'Papa', grams: 1000, expiresOn: null, custom: null }]),
      buyNext: jest.fn(async () => []),
    });
    await render(<PantryScreen />, { wrapper: withServices(fakeServices({ pantry })) });
    expect(await screen.findByText('Papa')).toBeOnTheScreen();
    expect(screen.queryByText('Para completar más recetas')).not.toBeOnTheScreen();
  });
});
