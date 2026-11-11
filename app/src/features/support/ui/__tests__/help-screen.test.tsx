import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';

import { HelpScreen } from '@/features/support/ui/help-screen';
import { fakeServices, withServices } from '@/test/fakes';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));

describe('Ayuda (US-151)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('no envía un mensaje vacío y explica qué falta', async () => {
    const services = fakeServices();
    await render(<HelpScreen />, { wrapper: withServices(services) });
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByText('Este campo es obligatorio.')).toBeOnTheScreen();
    expect(services.support.send).not.toHaveBeenCalled();
  });

  it('envía una sugerencia con captura y confirma', async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///captura.png', mimeType: 'image/png', width: 10, height: 10 }],
    } as ImagePicker.ImagePickerResult);
    const services = fakeServices();
    await render(<HelpScreen />, { wrapper: withServices(services) });

    await fireEvent.press(screen.getByRole('radio', { name: 'Una sugerencia' }));
    await fireEvent.changeText(screen.getByLabelText('¿Qué te gustaría que hiciera NutriPlan?'), '  Recetas con ulluco  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Adjuntar una captura' }));
    expect(await screen.findByText('Captura adjunta')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() =>
      expect(services.support.send).toHaveBeenCalledWith({
        category: 'suggestion',
        message: 'Recetas con ulluco',
        screenshot: { uri: 'file:///captura.png', mimeType: 'image/png' },
      }),
    );
    expect(await screen.findByText('Gracias por tu idea. La tendremos en cuenta.')).toBeOnTheScreen();
  });

  it('dice cuántos caracteres van y corta en 500', async () => {
    await render(<HelpScreen />, { wrapper: withServices(fakeServices()) });
    await fireEvent.changeText(screen.getByLabelText('¿Qué pasó? ¿En qué pantalla?'), 'a'.repeat(600));
    expect(screen.getByText('500 / 500')).toBeOnTheScreen();
  });
});
