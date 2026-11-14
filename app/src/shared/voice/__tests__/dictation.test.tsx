import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useLocalSearchParams } from 'expo-router';

import { AssistantScreen } from '@/features/assistant/ui/assistant-screen';
import { ShoppingScreen } from '@/features/shopping/ui/shopping-screen';
import { fakeServices, fakeShopping, withServices } from '@/test/fakes';

// El mock del reconocedor (jest.setup.ts) deja disparar sus eventos.
const { __emit: emit } = jest.requireMock('expo-speech-recognition') as { __emit: (name: string, event: unknown) => void };
const say = async (transcript: string, isFinal = true) => {
  await act(async () => emit('result', { results: [{ transcript }], isFinal }));
};

describe('Asistente v2, entrega 2: micrófono junto a enviar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useLocalSearchParams).mockReturnValue({});
  });

  it('toca el micrófono, habla, el texto queda en la caja para revisarlo y se envía con la flecha', async () => {
    const services = fakeServices();
    await render(<AssistantScreen />, { wrapper: withServices(services) });

    await fireEvent.press(screen.getByRole('button', { name: 'Dictar' }));
    await waitFor(() => expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalled());
    expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledWith(
      expect.objectContaining({ lang: 'es-CO', interimResults: true, requiresOnDeviceRecognition: true }),
    );
    expect(await screen.findByText(/Te escucho/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Terminar de dictar' })).toBeOnTheScreen();

    await say('algo rápido', false); // mientras habla
    expect(screen.getByLabelText('Escribe tu pedido').props.value).toBe('algo rápido');
    await say('algo rápido para el almuerzo');
    expect(screen.getByLabelText('Escribe tu pedido').props.value).toBe('algo rápido para el almuerzo');
    expect(services.assistant.send).not.toHaveBeenCalled(); // no se envía solo: se revisa primero

    await fireEvent.press(screen.getByRole('button', { name: 'Terminar de dictar' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() =>
      expect(services.assistant.send).toHaveBeenCalledWith(expect.objectContaining({ message: 'algo rápido para el almuerzo' })),
    );
  });

  it('lo dictado se suma a lo que ya estaba escrito', async () => {
    await render(<AssistantScreen />, { wrapper: withServices(fakeServices()) });
    await fireEvent.changeText(screen.getByLabelText('Escribe tu pedido'), 'Para la cena:');
    await fireEvent.press(screen.getByRole('button', { name: 'Dictar' }));
    await waitFor(() => expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalled());
    await say('algo con pollo');
    expect(screen.getByLabelText('Escribe tu pedido').props.value).toBe('Para la cena: algo con pollo');
  });

  it('sin permiso del micrófono lo explica y no escucha', async () => {
    jest.mocked(ExpoSpeechRecognitionModule.requestPermissionsAsync).mockResolvedValueOnce({ granted: false } as never);
    await render(<AssistantScreen />, { wrapper: withServices(fakeServices()) });
    await fireEvent.press(screen.getByRole('button', { name: 'Dictar' }));
    expect(await screen.findByText(/Sin permiso del micrófono/)).toBeOnTheScreen();
    expect(ExpoSpeechRecognitionModule.start).not.toHaveBeenCalled();
  });

  it('si no oyó nada, lo dice; si el teléfono no tiene el español descargado, intenta con el servicio de voz', async () => {
    await render(<AssistantScreen />, { wrapper: withServices(fakeServices()) });
    await fireEvent.press(screen.getByRole('button', { name: 'Dictar' }));
    await waitFor(() => expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledTimes(1));

    await act(async () => emit('error', { error: 'language-not-supported', message: '' }));
    await act(async () => emit('end', {})); // fin del primer intento: sigue escuchando con el segundo
    expect(screen.getByRole('button', { name: 'Terminar de dictar' })).toBeOnTheScreen();
    expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledTimes(2);
    expect(ExpoSpeechRecognitionModule.start).toHaveBeenLastCalledWith(expect.objectContaining({ requiresOnDeviceRecognition: false }));

    await act(async () => emit('error', { error: 'no-speech', message: '' }));
    await act(async () => emit('end', {}));
    expect(await screen.findByText('No te escuché. Toca el micrófono e inténtalo otra vez.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Dictar' })).toBeOnTheScreen();
  });
});

describe('Lista de mercado: dictar varios productos', () => {
  beforeEach(() => jest.clearAllMocks());

  it('"pollo, pan y yuca" dictado son tres productos', async () => {
    const shopping = fakeShopping();
    await render(<ShoppingScreen />, { wrapper: withServices(fakeServices({ shopping })) });
    await fireEvent.press(await screen.findByRole('button', { name: 'Dictar' }));
    await waitFor(() => expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalled());
    await say('pollo, pan y yuca');

    expect(screen.getByText('Se agregan 3: pollo · pan · yuca')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Agregar 3 a la lista' }));
    await waitFor(() => expect(shopping.addManual).toHaveBeenCalledTimes(3));
  });
});
