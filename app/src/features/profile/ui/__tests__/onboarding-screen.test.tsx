import { fireEvent, render, screen } from '@testing-library/react-native';

import { OnboardingScreen } from '@/features/profile/ui/onboarding-screen';
import { fakeProfile, fakeServices, withServices } from '@/test/fakes';

describe('Onboarding (US-106 a US-109)', () => {
  it('muestra el avance por pasos y vuelve al paso anterior desde el encabezado', async () => {
    const profile = fakeProfile();
    await render(<OnboardingScreen />, { wrapper: withServices(fakeServices({ profile })) });

    expect(await screen.findByRole('progressbar', { name: 'Paso 1 de 5' })).toBeOnTheScreen();
    expect(screen.getByText('Tu hogar')).toBeOnTheScreen();
    // En el primer paso no hay a dónde volver.
    expect(screen.queryByRole('button', { name: 'Volver' })).not.toBeOnTheScreen();

    await fireEvent.press(await screen.findByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('progressbar', { name: 'Paso 2 de 5' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(await screen.findByRole('progressbar', { name: 'Paso 1 de 5' })).toBeOnTheScreen();
  });
});
