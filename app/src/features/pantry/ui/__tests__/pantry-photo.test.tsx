import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { AppError } from '@/core/errors/app-error';
import { addDays, todayIso } from '@/features/pantry/domain/pantry';
import { AddPantryItemScreen } from '@/features/pantry/ui/add-pantry-item-screen';
import { takePantryPhoto } from '@/features/pantry/ui/take-photo';
import { fakePantry, fakeServices, withServices } from '@/test/fakes';

jest.mock('@/features/pantry/ui/take-photo', () => ({ takePantryPhoto: jest.fn() }));
const PHOTO = { kind: 'photo' as const, photo: { base64: 'AAAA', mimeType: 'image/jpeg' } };

describe('ADR-032 · foto de la nevera o del recibo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(takePantryPhoto).mockResolvedValue(PHOTO);
  });

  it('F-2/F-3: reconoce lo de la nevera; lo dudoso llega desmarcado y nada se guarda hasta "Guardar"', async () => {
    const services = fakeServices();
    await render(<AddPantryItemScreen />, { wrapper: withServices(services) });
    expect(screen.getByText('La foto no se guarda: se usa una vez para reconocer los alimentos.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Tomar foto' }));
    expect(takePantryPhoto).toHaveBeenCalledWith('camera');
    expect(await screen.findByRole('header', { name: 'Revisa lo que vi' })).toBeOnTheScreen();
    expect(services.pantry.understandPhoto).toHaveBeenCalledWith(PHOTO.photo, 'fridge');
    expect(screen.getByRole('checkbox', { name: 'Huevo' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Salsa rosada' })).not.toBeChecked();
    expect(screen.getByText('no estoy segura')).toBeOnTheScreen();
    expect(services.pantry.add).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Guardar 1 cosa' }));
    await waitFor(() =>
      expect(services.pantry.add).toHaveBeenCalledWith({ ingredientId: 'huevo', quantity: 10, unitId: 8, expiresOn: addDays(todayIso(), 21) }),
    );
    expect(services.pantry.addCustom).not.toHaveBeenCalled();
    expect(useRouter().back).toHaveBeenCalled();
  });

  it('F-4: del recibo pregunta antes de sumar el total al gasto del mes', async () => {
    const services = fakeServices();
    await render(<AddPantryItemScreen />, { wrapper: withServices(services) });
    await fireEvent.press(screen.getByRole('radio', { name: 'Del recibo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Elegir de la galería' }));
    expect(takePantryPhoto).toHaveBeenCalledWith('library');
    await screen.findByRole('header', { name: 'Revisa lo que vi' });
    expect(services.pantry.understandPhoto).toHaveBeenCalledWith(PHOTO.photo, 'receipt');

    await fireEvent.press(screen.getByRole('button', { name: 'Guardar 1 cosa' }));
    expect(await screen.findByText('El recibo dice que pagaste $ 45.000. ¿Lo sumo a tu gasto del mes?')).toBeOnTheScreen();
    expect(services.spending.recordPurchase).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Sí, sumarlo' }));
    await waitFor(() => expect(services.spending.recordPurchase).toHaveBeenCalledWith(45000, undefined));
    expect(useRouter().back).toHaveBeenCalled();
  });

  it('F-4: si no quiere, el total no se suma', async () => {
    const services = fakeServices();
    await render(<AddPantryItemScreen />, { wrapper: withServices(services) });
    await fireEvent.press(screen.getByRole('radio', { name: 'Del recibo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tomar foto' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Guardar 1 cosa' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'No, gracias' }));
    expect(services.spending.recordPurchase).not.toHaveBeenCalled();
    expect(useRouter().back).toHaveBeenCalled();
  });

  it('F-1: sin permiso de cámara lo explica y ofrece la galería', async () => {
    jest.mocked(takePantryPhoto).mockResolvedValueOnce({ kind: 'denied' });
    const services = fakeServices();
    await render(<AddPantryItemScreen />, { wrapper: withServices(services) });
    await fireEvent.press(screen.getByRole('button', { name: 'Tomar foto' }));
    expect(await screen.findByText(/Sin permiso de cámara/)).toBeOnTheScreen();
    expect(services.pantry.understandPhoto).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Elegir de la galería' })).toBeEnabled();
  });

  it('F-6: si la foto no sirve, lo dice y ofrece repetirla', async () => {
    const pantry = fakePantry({ understandPhoto: jest.fn(async () => ({ items: [], total: null, problem: 'unclear' as const })) });
    await render(<AddPantryItemScreen />, { wrapper: withServices(fakeServices({ pantry })) });
    await fireEvent.press(screen.getByRole('button', { name: 'Tomar foto' }));
    expect(await screen.findByText(/muy oscura o borrosa/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tomar otra foto' })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Revisa lo que vi' })).not.toBeOnTheScreen();
  });

  it('sin IA disponible, ofrece escribirlo o buscarlo', async () => {
    const pantry = fakePantry({ understandPhoto: jest.fn(async () => { throw new AppError('ai_unavailable'); }) });
    await render(<AddPantryItemScreen />, { wrapper: withServices(fakeServices({ pantry })) });
    await fireEvent.press(screen.getByRole('button', { name: 'Tomar foto' }));
    expect(await screen.findByText(/No pude analizar la foto en este momento/)).toBeOnTheScreen();
  });

  it('cancelar la cámara no hace nada', async () => {
    jest.mocked(takePantryPhoto).mockResolvedValueOnce({ kind: 'canceled' });
    const services = fakeServices();
    await render(<AddPantryItemScreen />, { wrapper: withServices(services) });
    await fireEvent.press(screen.getByRole('button', { name: 'Tomar foto' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tomar foto' })).toBeEnabled());
    expect(services.pantry.understandPhoto).not.toHaveBeenCalled();
  });
});

// El ayudante real (sin el mock de arriba): permiso, cámara o galería, y reducción antes de enviar.
describe('takePantryPhoto', () => {
  const real = jest.requireActual<typeof import('@/features/pantry/ui/take-photo')>('@/features/pantry/ui/take-photo');

  it('F-1: el permiso de cámara se pide al tocar; si se niega, no abre la cámara', async () => {
    jest.spyOn(ImagePicker, 'requestCameraPermissionsAsync').mockResolvedValue({ granted: false } as ImagePicker.PermissionResponse);
    const launch = jest.spyOn(ImagePicker, 'launchCameraAsync');
    expect(await real.takePantryPhoto('camera')).toEqual({ kind: 'denied' });
    expect(launch).not.toHaveBeenCalled();
  });
});
