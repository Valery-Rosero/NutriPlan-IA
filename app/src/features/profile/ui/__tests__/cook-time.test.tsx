import { fireEvent, render, screen } from '@testing-library/react-native';

import type { LegalDocKind } from '@/features/legal/domain/legal';
import { CookTimeNotice } from '@/features/profile/ui/cook-time-notice';
import { PreferencesForm } from '@/features/profile/ui/preferences-form';
import { fakeLegal, fakeProfile, fakeServices, PROFILE, withServices } from '@/test/fakes';

describe('Tiempo y gustos (US-137, US-138)', () => {
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

  it('US-138: las cocinas favoritas parten de lo guardado y se guardan juntas', async () => {
    const profile = fakeProfile({ getCuisines: jest.fn(async () => [4]) });
    await render(<PreferencesForm submitLabel="Guardar" onSaved={jest.fn()} />, { wrapper: withServices(fakeServices({ profile })) });

    expect(await screen.findByRole('checkbox', { name: 'Andina' })).toBeChecked();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Italiana' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));

    expect(profile.setCuisines).toHaveBeenCalledWith([4, 5]);
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

  it('US-136: sin autorización de datos sensibles, las metas no se pueden fijar y se explica por qué', async () => {
    await render(<PreferencesForm submitLabel="Guardar" onSaved={jest.fn()} />, { wrapper: withServices(fakeServices()) });
    expect(
      await screen.findByText('Las metas de nutrición son datos sensibles: para guardarlas necesitamos tu autorización.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('radio', { name: '40 %' })).not.toBeOnTheScreen();
  });

  it('US-136: con autorización, la proteína reparte el 100 % y se guarda junto con la meta de kcal', async () => {
    const profile = fakeProfile();
    const legal = fakeLegal({ getAcceptedKinds: jest.fn(async (): Promise<LegalDocKind[]> => ['sensitive_data_authorization']) });
    await render(<PreferencesForm submitLabel="Guardar" onSaved={jest.fn()} />, {
      wrapper: withServices(fakeServices({ profile, legal })),
    });

    await fireEvent.press(await screen.findByRole('radio', { name: '40 %' }));
    expect(screen.getByText('Proteína 40 % · Carbohidratos 30 % · Grasa 30 %')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Meta de kcal al día (opcional)'), '2000');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));

    expect(profile.updateProfile).toHaveBeenCalledWith({ maxCookMinutes: null, targetProteinPct: 40, dailyKcalTarget: 2000 });
  });
});
