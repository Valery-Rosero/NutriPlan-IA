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
    expect(await screen.findByRole('button', { name: 'Organizar mi semana' })).toBeOnTheScreen();
  });

  it('agrega un ítem manual', async () => {
    const shopping = fakeShopping();
    await render(<ShoppingScreen />, { wrapper: withServices(fakeServices({ shopping })) });
    await fireEvent.changeText(await screen.findByLabelText('Agregar algo más'), 'Café');
    await fireEvent.press(screen.getByRole('button', { name: 'Agregar a la lista' }));
    expect(shopping.addManual).toHaveBeenCalledWith('list1', 'Café');
  });

  it('US-147: reemplaza un ítem por su sustituto con un toque', async () => {
    const shopping = fakeShopping();
    await render(<ShoppingScreen />, { wrapper: withServices(fakeServices({ shopping })) });

    await fireEvent.press(await screen.findByRole('button', { name: 'Ver con qué reemplazar Tomate' }));
    expect(screen.getByText('En lugar de Tomate puedes comprar:')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Pimentón' }));
    await waitFor(() => expect(shopping.substitute).toHaveBeenCalledWith('i1', 'pimenton'));
  });

  it('US-147: lo sustituido dice a quién reemplaza y se puede deshacer', async () => {
    const shopping = fakeShopping({
      forPlan: jest.fn(async () => ({
        ...SHOPPING,
        items: SHOPPING.items.map((i) => (i.id === 'i2' ? { ...i, name: 'Muslo de pollo', replacesName: 'Pechuga de pollo' } : i)),
      })),
    });
    await render(<ShoppingScreen />, { wrapper: withServices(fakeServices({ shopping })) });

    expect(await screen.findByText('En lugar de Pechuga de pollo')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'Deshacer' }));
    await waitFor(() => expect(shopping.undoSubstitution).toHaveBeenCalledWith('i2'));
  });

  it('US-141: al pasar lo comprado a la despensa registra cuánto se pagó', async () => {
    const shopping = fakeShopping({
      forPlan: jest.fn(async () => ({ ...SHOPPING, items: SHOPPING.items.map((i) => (i.id === 'i1' ? { ...i, checked: true } : i)) })),
    });
    const services = fakeServices({ shopping });
    await render(<ShoppingScreen />, { wrapper: withServices(services) });

    await fireEvent.changeText(await screen.findByLabelText('¿Cuánto pagaste? (opcional)'), '45.000');
    await fireEvent.press(screen.getByRole('button', { name: 'Pasar 1 comprado a la despensa' }));

    await waitFor(() => expect(services.spending.recordPurchase).toHaveBeenCalledWith(45000, 'list1'));
    expect(await screen.findByText('Listo, sumamos la compra a tu gasto del mes.')).toBeOnTheScreen();
  });

  it('US-141: sin monto, pasa a la despensa sin registrar compra', async () => {
    const shopping = fakeShopping({
      forPlan: jest.fn(async () => ({ ...SHOPPING, items: SHOPPING.items.map((i) => (i.id === 'i1' ? { ...i, checked: true } : i)) })),
    });
    const services = fakeServices({ shopping });
    await render(<ShoppingScreen />, { wrapper: withServices(services) });
    await fireEvent.press(await screen.findByRole('button', { name: 'Pasar 1 comprado a la despensa' }));
    await waitFor(() => expect(shopping.moveCheckedToPantry).toHaveBeenCalled());
    expect(services.spending.recordPurchase).not.toHaveBeenCalled();
  });
});
