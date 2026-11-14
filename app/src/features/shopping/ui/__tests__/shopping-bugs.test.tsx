import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ShoppingScreen } from '@/features/shopping/ui/shopping-screen';
import { fakeServices, fakeShopping, SHOPPING, withServices } from '@/test/fakes';

/** Lo que se vio en el Honor 200 (14-nov): lista de mercado después de comprar. */
describe('Lista de mercado: arreglos tras probar en el teléfono', () => {
  beforeEach(() => jest.clearAllMocks());

  it('marcar algo escrito a mano ("Bolsas", "Café") también ofrece pasarlo y anotar lo pagado', async () => {
    const shopping = fakeShopping();
    await render(<ShoppingScreen />, { wrapper: withServices(fakeServices({ shopping })) });
    shopping.forPlan.mockResolvedValue({ ...SHOPPING, items: SHOPPING.items.map((i) => (i.id === 'i4' ? { ...i, checked: true } : i)) });
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Bolsas' }));

    expect(await screen.findByRole('button', { name: 'Pasar 1 comprado a la despensa' })).toBeOnTheScreen();
    expect(screen.getByLabelText('¿Cuánto pagaste? (opcional)')).toBeOnTheScreen();
  });

  it('los avisos de la compra se limpian con lo siguiente que se hace', async () => {
    const services = fakeServices();
    const { shopping } = services;
    jest.mocked(shopping.forPlan).mockResolvedValue({ ...SHOPPING, items: SHOPPING.items.map((i) => (i.id === 'i1' ? { ...i, checked: true } : i)) });
    await render(<ShoppingScreen />, { wrapper: withServices(services) });

    await fireEvent.changeText(await screen.findByLabelText('¿Cuánto pagaste? (opcional)'), '45000');
    await fireEvent.press(screen.getByRole('button', { name: 'Pasar 1 comprado a la despensa' }));
    expect(await screen.findByText('Listo: 1 producto quedó en tu despensa.')).toBeOnTheScreen();
    expect(await screen.findByText('Listo, sumamos la compra a tu gasto del mes.')).toBeOnTheScreen();
    expect(services.spending.recordPurchase).toHaveBeenCalledWith(45000, 'list1');

    // Se marca otra cosa: los avisos de la compra anterior ya no aplican.
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Huevo · 4 unidades (≈ 200 g)' }));
    await waitFor(() => expect(screen.queryByText('Listo: 1 producto quedó en tu despensa.')).not.toBeOnTheScreen());
    expect(screen.queryByText('Listo, sumamos la compra a tu gasto del mes.')).not.toBeOnTheScreen();
  });

  it('si se olvidó anotar lo pagado, se puede sumar justo después de pasar a la despensa', async () => {
    const services = fakeServices();
    const { shopping } = services;
    jest.mocked(shopping.forPlan).mockResolvedValue({ ...SHOPPING, items: SHOPPING.items.map((i) => (i.id === 'i1' ? { ...i, checked: true } : i)) });
    await render(<ShoppingScreen />, { wrapper: withServices(services) });

    const moveButton = await screen.findByRole('button', { name: 'Pasar 1 comprado a la despensa' });
    // Al pasar, la base devuelve lo marcado ya cerrado
    jest.mocked(shopping.forPlan).mockResolvedValue({ ...SHOPPING, items: SHOPPING.items.map((i) => (i.id === 'i1' ? { ...i, checked: true, movedToPantry: true } : i)) });
    await fireEvent.press(moveButton);
    await fireEvent.changeText(await screen.findByLabelText('¿Cuánto pagaste por esta compra? (opcional)'), '$ 32.500');
    await fireEvent.press(screen.getByRole('button', { name: 'Sumar al gasto del mes' }));
    await waitFor(() => expect(services.spending.recordPurchase).toHaveBeenCalledWith(32500, 'list1'));
    expect(await screen.findByText('Listo, sumamos la compra a tu gasto del mes.')).toBeOnTheScreen();
  });

  it('"Pollo, pan, yuca" se agrega como tres cosas, cada una en su sección', async () => {
    const shopping = fakeShopping();
    await render(<ShoppingScreen />, { wrapper: withServices(fakeServices({ shopping })) });
    await fireEvent.changeText(await screen.findByLabelText('Agregar algo más'), 'Pollo, pan, yuca');
    await fireEvent.press(screen.getByRole('button', { name: 'Agregar a la lista' }));
    await waitFor(() => expect(shopping.addManual).toHaveBeenCalledTimes(3));
    expect(jest.mocked(shopping.addManual).mock.calls.map((c) => c[1])).toEqual(['Pollo', 'pan', 'yuca']);
  });
});
