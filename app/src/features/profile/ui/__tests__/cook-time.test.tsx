import { fireEvent, render, screen } from '@testing-library/react-native';

import { CookTimeNotice } from '@/features/profile/ui/cook-time-notice';
import { PreferencesForm } from '@/features/profile/ui/preferences-form';
import { fakeProfile, fakeServices, PROFILE, withServices } from '@/test/fakes';

describe('tiempo máximo de cocina (US-137)', () => {
  it('se elige y se guarda en el perfil', async () => {
    const profile = fakeProfile();
    const onSaved = jest.fn();
    await render(<PreferencesForm submitLabel="Guardar" onSaved={onSaved} />, { wrapper: withServices(fakeServices({ profile })) });

    expect(await screen.findByRole('radio', { name: 'Sin límite' })).toBeSelected();
    await fireEvent.press(screen.getByRole('radio', { name: 'Hasta 20 min' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));

    expect(profile.updateProfile).toHaveBeenCalledWith({ maxCookMinutes: 20 });
    expect(onSaved).toHaveBeenCalled();
  });

  it('sin recetas que quepan, propone ampliar el límite en vez de una lista vacía', async () => {
    const profile = fakeProfile({ getProfile: jest.fn(async () => ({ ...PROFILE, maxCookMinutes: 20 })) });
    await render(<CookTimeNotice />, { wrapper: withServices(fakeServices({ profile })) });

    expect(
      await screen.findByText('No encontramos recetas de 20 min o menos con tus restricciones actuales. ¿Probamos con 30?'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Probar con 30 min' }));
    expect(profile.updateProfile).toHaveBeenCalledWith({ maxCookMinutes: 30 });
  });

  it('sin límite no muestra nada (el vacío tiene otra causa)', async () => {
    await render(<CookTimeNotice />, { wrapper: withServices(fakeServices()) });
    expect(screen.queryByRole('button', { name: /Probar con|Quitar el límite/ })).not.toBeOnTheScreen();
  });
});
