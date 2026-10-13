import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ShoppingScreen } from '@/features/shopping/ui/shopping-screen';
import { fakePlans, fakeServices, fakeShopping, SHOPPING, withServices } from '@/test/fakes';

describe('ShoppingScreen (US-124, US-125, US-126, US-135)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('muestra solo lo que hay que comprar, por sección, con unidades aproximadas', async () => {
    await render(<ShoppingScreen />, { wrapper: withServices(fakeServices()) });
    expect(await screen.findByRole('checkbox', { name: 'Tomate · 3 unidades (≈ 360 g)' })).toBeOnTheScreen();
    expect(screen.getByText('Lácteos y huevos')).toBeOnTheScreen();
    expect(screen.getByText('Arroz blanco · tienes 1 kg')).toBeOnTheScreen();
    expect(screen.getByText('0 de 3 comprados')).toBeOnTheScreen();
  });

  it('marcar es inmediato (optimista) y se guarda; luego ofrece pasarlo a la despensa', async () => {
    const shopping = fakeShopping();
    await render(<ShoppingScreen />, { wrapper: withServices(fakeServices({ shopping })) });
    const tomato = await screen.findByRole('checkbox', { name: 'Tomate · 3 unidades (≈ 360 g)' });
    // lo que devolverá el servidor una vez guardado
    shopping.forPlan.mockResolvedValue({ ...SHOPPING, items: SHOPPING.items.map((i) => (i.id === 'i1' ? { ...i, checked: true } : i)) });
    await fireEvent.press(tomato);

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Tomate · 3 unidades (≈ 360 g)' })).toBeChecked());
    expect(shopping.setChecked).toHaveBeenCalledWith('i1', true);
    await fireEvent.press(await screen.findByRole('button', { name: 'Pasar 1 comprado a la despensa' }));
    expect(shopping.moveCheckedToPantry).toHaveBeenCalledWith('list1');
  });

  it('sin lista la arma desde el plan; sin plan lleva al plan', async () => {
    const shopping = fakeShopping({ forPlan: jest.fn(async () => null) });
    await render(<ShoppingScreen />, { wrapper: withServices(fakeServices({ shopping })) });
    await fireEvent.press(await screen.findByRole('button', { name: 'Armar lista de compras' }));
    expect(shopping.generate).toHaveBeenCalledWith('plan1');
  });

  it('sin plan pide armarlo primero', async () => {
    const plans = fakePlans({ current: jest.fn(async () => null) });
    await render(<ShoppingScreen />, { wrapper: withServices(fakeServices({ plans })) });
    expect(await screen.findByRole('button', { name: 'Ir al plan' })).toBeOnTheScreen();
  });

  it('agrega un ítem manual', async () => {
    const shopping = fakeShopping();
    await render(<ShoppingScreen />, { wrapper: withServices(fakeServices({ shopping })) });
    await fireEvent.changeText(await screen.findByLabelText('Agregar algo más'), 'Café');
    await fireEvent.press(screen.getByRole('button', { name: 'Agregar a la lista' }));
    expect(shopping.addManual).toHaveBeenCalledWith('list1', 'Café');
  });
});
