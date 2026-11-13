import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import type { PantryItem } from '@/features/pantry/domain/pantry';
import { AddPantryItemScreen } from '@/features/pantry/ui/add-pantry-item-screen';
import { PantryScreen } from '@/features/pantry/ui/pantry-screen';
import { fakePantry, fakeServices, withServices } from '@/test/fakes';

const QUESO: PantryItem = {
  id: 'c1', ingredientId: null, name: 'Galletas de la tienda', grams: 0, expiresOn: null, custom: { quantity: 2, unit: 'unit' },
};
const ARROZ: PantryItem = { id: 'p1', ingredientId: 'i-arroz', name: 'Arroz', grams: 1000, expiresOn: null, custom: null };

describe('B3b: alimentos propios en la despensa', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lo que no está en el catálogo se agrega como alimento propio, con la sección que sugiere la clasificación', async () => {
    const pantry = fakePantry();
    const services = fakeServices({ pantry });
    await render(<AddPantryItemScreen />, { wrapper: withServices(services) });

    await fireEvent.changeText(await screen.findByLabelText('¿Qué tienes?'), 'queso campesino');
    await fireEvent.press(await screen.findByRole('button', { name: 'Agregar «queso campesino» como alimento propio' }));
    expect(screen.getByText('Alimento propio')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Cantidad'), '500');
    await fireEvent.press(screen.getByRole('radio', { name: 'g' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar en la despensa' }));

    await waitFor(() =>
      expect(pantry.addCustom).toHaveBeenCalledWith({
        name: 'queso campesino', quantity: 500, unit: 'g', expiresOn: null, foodGroupId: 16, storeCategoryId: 3,
      }),
    );
    expect(services.foodLabels.classify).toHaveBeenCalledWith('queso campesino');
    expect(useRouter().back).toHaveBeenCalled();
  });

  it('si la clasificación falla, se guarda igual (sin grupo ni sección)', async () => {
    const pantry = fakePantry();
    const services = fakeServices({ pantry });
    services.foodLabels.classify = jest.fn(async () => { throw new Error('sin red'); });
    await render(<AddPantryItemScreen />, { wrapper: withServices(services) });

    await fireEvent.changeText(await screen.findByLabelText('¿Qué tienes?'), 'galletas');
    await fireEvent.press(await screen.findByRole('button', { name: 'Agregar «galletas» como alimento propio' }));
    await fireEvent.changeText(screen.getByLabelText('Cantidad'), '2');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar en la despensa' }));

    await waitFor(() =>
      expect(pantry.addCustom).toHaveBeenCalledWith(expect.objectContaining({ name: 'galletas', quantity: 2, unit: 'unit', foodGroupId: null, storeCategoryId: null })),
    );
  });

  it('sin cantidad válida no deja guardar', async () => {
    await render(<AddPantryItemScreen />, { wrapper: withServices(fakeServices()) });
    await fireEvent.changeText(await screen.findByLabelText('¿Qué tienes?'), 'galletas');
    await fireEvent.press(await screen.findByRole('button', { name: 'Agregar «galletas» como alimento propio' }));
    await fireEvent.changeText(screen.getByLabelText('Cantidad'), '0');
    expect(screen.getByRole('button', { name: 'Guardar en la despensa' })).toBeDisabled();
  });

  it('en la despensa se ve con su unidad y la etiqueta "Propio"; quitarlo lo borra de su tabla', async () => {
    const pantry = fakePantry({ list: jest.fn(async () => [QUESO, ARROZ]) });
    await render(<PantryScreen />, { wrapper: withServices(fakeServices({ pantry })) });

    expect(await screen.findByText('2 unidades')).toBeOnTheScreen();
    expect(screen.getByText('Propio')).toBeOnTheScreen();
    expect(screen.getByLabelText('Galletas de la tienda (Propio), 2 unidades. Sin fecha de vencimiento.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Quitar Galletas de la tienda' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Quitar' }));
    await waitFor(() => expect(pantry.remove).toHaveBeenCalledWith(QUESO));
  });
});
