import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppError } from '@/core/errors/app-error';
import { RestrictionsForm } from '@/features/profile/ui/restrictions-form';
import { fakeProfile, fakeServices, withServices } from '@/test/fakes';

describe('RestrictionsForm (US-106, US-107)', () => {
  it('guarda las alergias y dietas marcadas en una sola operación', async () => {
    const profile = fakeProfile();
    const onSaved = jest.fn();
    await render(<RestrictionsForm submitLabel="Guardar" onSaved={onSaved} />, {
      wrapper: withServices(fakeServices({ profile })),
    });

    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Huevo' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Vegano' }));
    expect(screen.getByRole('checkbox', { name: 'Huevo' })).toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));

    expect(profile.setRestrictions).toHaveBeenCalledWith({ allergenIds: [5], dietIds: [2] });
    expect(onSaved).toHaveBeenCalled();
  });

  it('parte de lo que ya estaba guardado', async () => {
    const profile = fakeProfile({ getRestrictions: jest.fn(async () => ({ allergenIds: [6], dietIds: [] })) });
    await render(<RestrictionsForm submitLabel="Guardar" onSaved={jest.fn()} />, { wrapper: withServices(fakeServices({ profile })) });
    expect(await screen.findByRole('checkbox', { name: 'Leche' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Huevo' })).not.toBeChecked();
  });

  it('si falta la autorización de datos sensibles, lo explica', async () => {
    const profile = fakeProfile({
      setRestrictions: jest.fn(async () => Promise.reject(new AppError('sensitive_authorization_required'))),
    });
    await render(<RestrictionsForm submitLabel="Guardar" onSaved={jest.fn()} />, { wrapper: withServices(fakeServices({ profile })) });
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Huevo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText(/Necesitamos tu autorización/)).toBeOnTheScreen();
  });
});
