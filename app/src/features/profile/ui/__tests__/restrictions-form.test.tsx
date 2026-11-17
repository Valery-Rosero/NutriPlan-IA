import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppError } from '@/core/errors/app-error';
import { RestrictionsForm } from '@/features/profile/ui/restrictions-form';
import { fakePantry, fakeProfile, fakeServices, withServices } from '@/test/fakes';

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

    expect(profile.setRestrictions).toHaveBeenCalledWith({ allergenIds: [5], dietIds: [2], customAllergies: [] });
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

  it('US-187: escribe sus propias alergias, del recetario o a mano, y las guarda con el resto', async () => {
    const profile = fakeProfile();
    const pantry = fakePantry({
      search: jest.fn(async (q: string) => (q.toLowerCase().startsWith('tom') ? [{ id: 'tomate', name: 'Tomate', countUnits: [] }] : [])),
    });
    await render(<RestrictionsForm submitLabel="Guardar" onSaved={jest.fn()} />, {
      wrapper: withServices(fakeServices({ profile, pantry })),
    });

    // Del recetario: sale como sugerencia
    await fireEvent.changeText(await screen.findByLabelText('¿Otra alergia? Escríbela'), 'tom');
    await fireEvent.press(await screen.findByRole('button', { name: 'Tomate' }));
    expect(screen.getByRole('checkbox', { name: 'Tomate' })).toBeChecked();

    // A mano: no está en el recetario
    await fireEvent.changeText(screen.getByLabelText('¿Otra alergia? Escríbela'), 'Kiwi');
    await fireEvent.press(await screen.findByRole('button', { name: 'Agregar «Kiwi» como alergia propia' }));
    expect(screen.getByText(/«Kiwi» no está en nuestras recetas/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(profile.setRestrictions).toHaveBeenCalledWith({
      allergenIds: [],
      dietIds: [],
      customAllergies: [{ ingredientId: 'tomate', label: 'Tomate' }, { ingredientId: null, label: 'Kiwi' }],
    });
  });

  it('US-187: se quita una alergia propia tocándola y no se repite la misma', async () => {
    const profile = fakeProfile({
      getRestrictions: jest.fn(async () => ({ allergenIds: [], dietIds: [], customAllergies: [{ ingredientId: null, label: 'Kiwi' }] })),
    });
    await render(<RestrictionsForm submitLabel="Guardar" onSaved={jest.fn()} />, { wrapper: withServices(fakeServices({ profile })) });

    await fireEvent.changeText(await screen.findByLabelText('¿Otra alergia? Escríbela'), 'kiwi');
    expect(screen.queryByRole('button', { name: 'Agregar «kiwi» como alergia propia' })).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Kiwi' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(profile.setRestrictions).toHaveBeenCalledWith({ allergenIds: [], dietIds: [], customAllergies: [] });
  });

  it('US-187: la lista trae ejemplos para reconocer cada alergia', async () => {
    const profile = fakeProfile({ listAllergens: jest.fn(async () => [{ id: 1, code: 'tree_nuts', name: 'Frutos secos' }]) });
    await render(<RestrictionsForm submitLabel="Guardar" onSaved={jest.fn()} />, { wrapper: withServices(fakeServices({ profile })) });
    expect(await screen.findByRole('checkbox', { name: 'Frutos secos (nueces, almendras…)' })).toBeOnTheScreen();
  });
});
