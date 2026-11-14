import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { addDays, todayIso, type PantryItem } from '@/features/pantry/domain/pantry';
import { AddPantryItemScreen } from '@/features/pantry/ui/add-pantry-item-screen';
import { PantryItemScreen } from '@/features/pantry/ui/pantry-item-screen';
import { PantryScreen } from '@/features/pantry/ui/pantry-screen';
import { QuickAdd } from '@/features/pantry/ui/quick-add';
import { fakePantry, fakeServices, withServices } from '@/test/fakes';

const today = todayIso();
const PAPA_1: PantryItem = { id: 'p1', ingredientId: 'papa', name: 'Papa', grams: 1000, expiresOn: null, custom: null, shelfLifeDays: 30 };
const PAPA_2: PantryItem = { ...PAPA_1, id: 'p2', grams: 500, expiresOn: addDays(today, 10) };
const HUEVO: PantryItem = {
  id: 'h1', ingredientId: 'huevo', name: 'Huevo', grams: 300, expiresOn: addDays(today, 15), custom: null, unitGrams: 50, unitName: 'unidad', shelfLifeDays: 21,
};
const LECHE_VENCIDA: PantryItem = { id: 'l1', ingredientId: 'leche', name: 'Leche', grams: 1000, expiresOn: addDays(today, -1), custom: null };

describe('Mi cocina, fase 2: corregir lo que hay (ADR-034)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('A6: la papa comprada dos veces se ve una sola vez, con el total; tocarla abre su edición', async () => {
    const pantry = fakePantry({ list: jest.fn(async () => [PAPA_1, PAPA_2]) });
    await render(<PantryScreen />, { wrapper: withServices(fakeServices({ pantry })) });

    const row = await screen.findByRole('button', { name: `Papa, 1,5 kg. Vence en 10 días.` });
    expect(screen.getAllByText('Papa')).toHaveLength(1);
    expect(screen.getByText('1,5 kg · 2 compras')).toBeOnTheScreen();
    await fireEvent.press(row);
    expect(useRouter().push).toHaveBeenCalledWith({ pathname: '/pantry/item', params: { key: 'i:papa' } });
  });

  it('C3: − / + de a un huevo y guardar manda solo la diferencia', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ key: 'i:huevo' });
    const pantry = fakePantry({ list: jest.fn(async () => [HUEVO]) });
    await render(<PantryItemScreen />, { wrapper: withServices(fakeServices({ pantry })) });

    expect(await screen.findAllByText('300 g · ≈ 6 unidades')).toHaveLength(2); // arriba y en el − / +
    await fireEvent.press(screen.getByRole('button', { name: 'Quitar 50 g · ≈ 1 unidad' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Quitar 50 g · ≈ 1 unidad' }));
    expect(screen.getByText('200 g · ≈ 4 unidades')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(pantry.adjust).toHaveBeenCalledWith('huevo', -100));
    expect(useRouter().back).toHaveBeenCalled();
  });

  it('C3: "queda la mitad" y "se acabó" (que quita todo lo vigente)', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ key: 'i:papa' });
    const pantry = fakePantry({ list: jest.fn(async () => [PAPA_1, PAPA_2]) });
    await render(<PantryItemScreen />, { wrapper: withServices(fakeServices({ pantry })) });

    expect(await screen.findByText('Lo compraste en 2 fechas')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Queda la mitad' }));
    expect(screen.getByText('750 g')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Se acabó' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Se acabó: quitar de mi cocina' }));
    await waitFor(() => expect(pantry.adjust).toHaveBeenCalledWith('papa', -1500));
  });

  it('C3: cambiar la fecha de una compra (lo normal para ese alimento primero)', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ key: 'i:papa' });
    const pantry = fakePantry({ list: jest.fn(async () => [PAPA_1, PAPA_2]) });
    await render(<PantryItemScreen />, { wrapper: withServices(fakeServices({ pantry })) });

    // Una por compra, en el orden de la despensa (lo que vence antes primero): la segunda es la de 1 kg sin fecha.
    expect(await screen.findByText('500 g · Vence en 10 días')).toBeOnTheScreen();
    expect(screen.getByText('1 kg · Sin fecha de vencimiento')).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByRole('link', { name: 'Cambiar fecha' })[1]);
    await fireEvent.press(await screen.findByRole('radio', { name: 'Lo normal: 30 días' }));
    await waitFor(() => expect(pantry.setExpiry).toHaveBeenCalledWith('p1', addDays(today, 30)));
  });

  it('un alimento propio se corrige en su unidad', async () => {
    const galletas: PantryItem = { id: 'c1', ingredientId: null, name: 'Galletas', grams: 0, expiresOn: null, custom: { quantity: 4, unit: 'unit' } };
    jest.mocked(useLocalSearchParams).mockReturnValue({ key: 'c:c1' });
    const pantry = fakePantry({ list: jest.fn(async () => [galletas]) });
    await render(<PantryItemScreen />, { wrapper: withServices(fakeServices({ pantry })) });

    await fireEvent.press(await screen.findByRole('radio', { name: 'Queda ¼' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(pantry.updateCustom).toHaveBeenCalledWith('c1', { quantity: 1 }));
  });

  it('M2: lo vencido tiene salida: "Todavía sirve" (2 días más) o "Quitar lo vencido"', async () => {
    const pantry = fakePantry({ list: jest.fn(async () => [LECHE_VENCIDA, PAPA_1]) });
    await render(<PantryScreen />, { wrapper: withServices(fakeServices({ pantry })) });

    await fireEvent.press(await screen.findByRole('link', { name: 'Todavía sirve' }));
    await waitFor(() => expect(pantry.setExpiry).toHaveBeenCalledWith('l1', addDays(today, 2)));

    await fireEvent.press(screen.getByRole('link', { name: 'Quitar lo vencido' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Quitar lo vencido' }));
    await waitFor(() => expect(pantry.removeExpired).toHaveBeenCalled());
  });

  it('si ya no está (se acabó en otro lado), lo dice en vez de quedarse en blanco', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ key: 'i:nada' });
    await render(<PantryItemScreen />, { wrapper: withServices(fakeServices()) });
    expect(await screen.findByText('Esto ya no está en tu cocina.')).toBeOnTheScreen();
  });

  it('A5: al agregar a mano, la fecha ya viene propuesta según el alimento', async () => {
    const pantry = fakePantry({
      search: jest.fn(async () => [{ id: 'huevo', name: 'Huevo', countUnits: [], shelfLifeDays: 21 }]),
    });
    await render(<AddPantryItemScreen />, { wrapper: withServices(fakeServices({ pantry })) });

    await fireEvent.changeText(await screen.findByLabelText('¿Qué tienes?'), 'huevo');
    await fireEvent.press(await screen.findByRole('button', { name: 'Huevo' }));
    expect(screen.getByRole('radio', { name: 'Lo normal: 21 días' })).toBeSelected();
    await fireEvent.changeText(screen.getByLabelText('Cantidad'), '300');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar en la despensa' }));
    await waitFor(() => expect(pantry.add).toHaveBeenCalledWith(expect.objectContaining({ ingredientId: 'huevo', expiresOn: addDays(today, 21) })));
  });

  it('M1: lo agregado con un toque se quita tocándolo otra vez (resta exactamente lo sumado)', async () => {
    const pantry = fakePantry();
    await render(<QuickAdd />, { wrapper: withServices(fakeServices({ pantry })) });

    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Arroz blanco' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Arroz blanco' })).toBeChecked());
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Arroz blanco' }));
    await waitFor(() => expect(pantry.adjust).toHaveBeenCalledWith('arroz', -1, 2));
  });
});
