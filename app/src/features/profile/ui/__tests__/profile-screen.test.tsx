import { fireEvent, render, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { ProfileScreen } from '@/features/profile/ui/profile-screen';
import { fakeServices, withServices } from '@/test/fakes';

describe('Perfil (US-116)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cada fila resume esa parte y lleva a editarla', async () => {
    await render(<ProfileScreen />, { wrapper: withServices(fakeServices()) });
    await fireEvent.press(await screen.findByRole('button', { name: /^Presupuesto:/ }));
    expect(useRouter().push).toHaveBeenCalledWith({ pathname: '/profile/[section]', params: { section: 'budget' } });
  });

  it('cerrar sesión pide confirmación', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<ProfileScreen />, { wrapper: withServices(fakeServices()) });
    await fireEvent.press(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    expect(alert).toHaveBeenCalledWith('¿Cerrar sesión en este teléfono?', undefined, expect.any(Array));
  });
});
