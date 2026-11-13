import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { OnboardingScreen } from '@/features/profile/ui/onboarding-screen';
import { fakeProfile, fakeServices, withServices } from '@/test/fakes';

/** Hogar → autorización ("Ahora no") → presupuesto ("No usar presupuesto"): llega a Preferencias. */
async function goToPreferences() {
  await fireEvent.press(await screen.findByRole('button', { name: 'Continuar' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Ahora no' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'No usar presupuesto' }));
  expect(await screen.findByRole('progressbar', { name: 'Paso 5 de 7' })).toBeOnTheScreen();
}

describe('Onboarding (US-106 a US-109)', () => {
  it('muestra el avance por pasos y vuelve al paso anterior desde el encabezado', async () => {
    const profile = fakeProfile();
    await render(<OnboardingScreen />, { wrapper: withServices(fakeServices({ profile })) });

    expect(await screen.findByRole('progressbar', { name: 'Paso 1 de 7' })).toBeOnTheScreen();
    expect(screen.getByText('Tu hogar')).toBeOnTheScreen();
    // En el primer paso no hay a dónde volver.
    expect(screen.queryByRole('button', { name: 'Volver' })).not.toBeOnTheScreen();

    await fireEvent.press(await screen.findByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('progressbar', { name: 'Paso 2 de 7' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(await screen.findByRole('progressbar', { name: 'Paso 1 de 7' })).toBeOnTheScreen();
  });
});

describe('Onboarding: preferencias y notificaciones al crear la cuenta', () => {
  it('pide tiempo y cocinas; sin autorización de salud no muestra las metas (no hay a dónde ir a darla)', async () => {
    const profile = fakeProfile();
    await render(<OnboardingScreen />, { wrapper: withServices(fakeServices({ profile })) });
    await goToPreferences();

    expect(screen.getByRole('header', { name: '¿Cómo te gusta cocinar?' })).toBeOnTheScreen();
    expect(await screen.findByText('¿Cuánto tiempo tienes para cocinar?')).toBeOnTheScreen();
    expect(screen.getByText('Cocinas favoritas')).toBeOnTheScreen();
    expect(screen.queryByText('Tus metas (opcional)')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(profile.updateProfile).toHaveBeenCalledWith({ maxCookMinutes: null }));
    expect(await screen.findByRole('progressbar', { name: 'Paso 6 de 7' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: '¿Te avisamos?' })).toBeOnTheScreen();
  });

  it('activa los avisos solo al tocar el botón y guarda la frecuencia al continuar', async () => {
    const services = fakeServices();
    await render(<OnboardingScreen />, { wrapper: withServices(services) });
    await goToPreferences();
    await fireEvent.press(await screen.findByRole('button', { name: 'Continuar' }));
    await screen.findByRole('progressbar', { name: 'Paso 6 de 7' });

    // El permiso del teléfono no se pide solo: hace falta tocar "Activar avisos".
    expect(services.push.register).not.toHaveBeenCalled();
    await fireEvent.press(await screen.findByRole('button', { name: 'Activar avisos' }));
    await waitFor(() => expect(services.push.register).toHaveBeenCalled());

    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(services.notifications.savePreferences).toHaveBeenCalled());
    expect(await screen.findByRole('progressbar', { name: 'Paso 7 de 7' })).toBeOnTheScreen();
  });

  it('"Ahora no" salta solo los avisos (sin guardar ni pedir permiso) y sigue a la cocina', async () => {
    const services = fakeServices();
    await render(<OnboardingScreen />, { wrapper: withServices(services) });
    await goToPreferences();
    await fireEvent.press(await screen.findByRole('button', { name: 'Continuar' }));
    await screen.findByRole('progressbar', { name: 'Paso 6 de 7' });

    await fireEvent.press(await screen.findByRole('link', { name: 'Ahora no' }));
    expect(await screen.findByRole('header', { name: '¿Qué hay en tu cocina?' })).toBeOnTheScreen();
    expect(services.push.register).not.toHaveBeenCalled();
    expect(services.notifications.savePreferences).not.toHaveBeenCalled();

    // Volver desde la cocina regresa a los avisos.
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(await screen.findByRole('header', { name: '¿Te avisamos?' })).toBeOnTheScreen();
  });
});
