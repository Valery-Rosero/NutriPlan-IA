import { fireEvent, render, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { WelcomeScreen } from '@/features/auth/ui/welcome-screen';
import { fakeServices, withServices } from '@/test/fakes';

describe('Bienvenida "Cocina viva"', () => {
  beforeEach(() => jest.clearAllMocks());

  it('el chef saluda con una descripción para el lector y la promesa va como título', async () => {
    await render(<WelcomeScreen />, { wrapper: withServices(fakeServices()) });
    expect(screen.getByLabelText(/El chef de NutriPlan/)).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Cocina rico con lo que ya tienes' })).toBeOnTheScreen();
  });

  it('lleva a crear la cuenta o a entrar', async () => {
    await render(<WelcomeScreen />, { wrapper: withServices(fakeServices()) });
    await fireEvent.press(screen.getByRole('button', { name: 'Crear mi cuenta' }));
    expect(useRouter().push).toHaveBeenCalledWith('/sign-up');
    await fireEvent.press(screen.getByRole('button', { name: 'Ya tengo cuenta' }));
    expect(useRouter().push).toHaveBeenCalledWith('/sign-in');
  });
});
