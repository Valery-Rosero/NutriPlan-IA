import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { ProfileScreen } from '@/features/profile/ui/profile-screen';
import { fakeServices, withServices } from '@/test/fakes';

describe('Perfil (US-116)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cada fila resume esa parte y lleva a editarla', async () => {
    await render(<ProfileScreen />, { wrapper: withServices(fakeServices()) });
    await fireEvent.press(await screen.findByRole('button', { name: /^Presupuesto:/ }));
    expect(useRouter().push).toHaveBeenCalledWith({ pathname: '/profile/[section]', params: { section: 'budget' } });
  });

  it('cerrar sesión pide confirmación con el diálogo de la app; cancelar no cierra', async () => {
    const services = fakeServices();
    await render(<ProfileScreen />, { wrapper: withServices(services) });
    await fireEvent.press(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByText('¿Cerrar sesión en este teléfono?')).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Cancelar' })[0]);
    expect(services.auth.signOut).not.toHaveBeenCalled();
  });

  it('al confirmar, cierra la sesión', async () => {
    const services = fakeServices();
    await render(<ProfileScreen />, { wrapper: withServices(services) });
    await fireEvent.press(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    const buttons = await screen.findAllByRole('button', { name: 'Cerrar sesión' });
    await fireEvent.press(buttons[buttons.length - 1]); // el del diálogo
    await waitFor(() => expect(services.auth.signOut).toHaveBeenCalled());
  });
});
