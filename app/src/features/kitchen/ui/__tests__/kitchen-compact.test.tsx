import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';

import { ServicesProvider } from '@/di/services';
import { KitchenScreen } from '@/features/kitchen/ui/kitchen-screen';
import { usePantry } from '@/features/pantry/application/pantry-queries';
import { isSoon, type PantryItem } from '@/features/pantry/domain/pantry';
import { AddPantryItemScreen } from '@/features/pantry/ui/add-pantry-item-screen';
import { QuickAdd } from '@/features/pantry/ui/quick-add';
import { shouldPersistQuery } from '@/infrastructure/query-client';
import { fakePantry, fakeServices, withServices } from '@/test/fakes';

const PAPA: PantryItem = { id: 'p1', ingredientId: 'papa', name: 'Papa', grams: 1000, expiresOn: null, custom: null };

describe('Mi cocina, fase 4: más pantalla, menos pasos (ADR-036)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('A3: encabezado de una fila, sin la frase; cuenta un alimento comprado dos veces como uno', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    const pantry = fakePantry({ list: jest.fn(async () => [PAPA, { ...PAPA, id: 'p2', grams: 500 }]) });
    await render(<KitchenScreen />, { wrapper: withServices(fakeServices({ pantry })) });

    expect(await screen.findByRole('header', { name: 'Mi cocina' })).toBeOnTheScreen();
    expect(screen.queryByText('Lo que tienes y lo que te falta, en un solo lugar.')).not.toBeOnTheScreen();
    expect(screen.getByText('1 ingrediente')).toBeOnTheScreen();
  });

  it('A3: en la lista, el gasto del mes va al final (primero lo que hay que comprar)', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ tab: 'list' });
    const services = fakeServices();
    await render(<KitchenScreen />, { wrapper: withServices(services) });
    await screen.findByRole('checkbox', { name: 'Tomate · 3 unidades (≈ 360 g)' });
    await screen.findByText('Gasto de este mes');
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('Tomate · 3 unidades')).toBeLessThan(tree.indexOf('Gasto de este mes'));
  });

  it('A4: Agregar abre en "Buscar" y muestra un camino a la vez', async () => {
    await render(<AddPantryItemScreen />, { wrapper: withServices(fakeServices()) });
    expect(screen.getByRole('radio', { name: 'Buscar' })).toBeSelected();
    expect(screen.getByLabelText('¿Qué tienes?')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Lo que compraste o tienes')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Foto' }));
    expect(screen.getByRole('button', { name: 'Tomar foto' })).toBeOnTheScreen();
    expect(screen.queryByLabelText('¿Qué tienes?')).not.toBeOnTheScreen();
  });

  it('M4: "Lo que tengo" se guarda en el teléfono para verlo sin señal', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ServicesProvider services={fakeServices({ pantry: fakePantry({ list: jest.fn(async () => [PAPA]) }) })}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </ServicesProvider>
    );
    const { result } = await renderHook(() => usePantry(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(shouldPersistQuery(client.getQueryCache().find({ queryKey: ['pantry', 'items'] })!)).toBe(true);
  });

  it('D2: lo típico viene de la base y no ofrece lo que ya está en la cocina (por ingrediente)', async () => {
    const pantry = fakePantry({ list: jest.fn(async () => [PAPA]) });
    await render(<QuickAdd />, { wrapper: withServices(fakeServices({ pantry })) });
    expect(await screen.findByRole('checkbox', { name: 'Arroz blanco' })).toBeOnTheScreen();
    expect(screen.queryByRole('checkbox', { name: 'Papa' })).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Huevo' }));
    await waitFor(() => expect(pantry.add).toHaveBeenCalledWith(expect.objectContaining({ ingredientId: 'huevo', quantity: 6, unitId: 4 })));
  });

  it('D4: una sola regla de "vence pronto": hoy y los 3 días siguientes', () => {
    expect([-1, 0, 3, 4].map(isSoon)).toEqual([false, true, true, false]);
  });
});
