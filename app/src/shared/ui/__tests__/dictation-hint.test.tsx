import { fireEvent, render, screen } from '@testing-library/react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useLocalSearchParams } from 'expo-router';

import { AssistantScreen } from '@/features/assistant/ui/assistant-screen';
import { AddPantryItemScreen } from '@/features/pantry/ui/add-pantry-item-screen';
import { fakeServices, withServices } from '@/test/fakes';

const HINT = '¿Prefieres hablar? Toca el micrófono de tu teclado y díctalo.';

describe('Notas de voz: si el teléfono no tiene reconocimiento, queda la pista del teclado (opción A)', () => {
  beforeEach(() => jest.mocked(ExpoSpeechRecognitionModule.isRecognitionAvailable).mockReturnValue(false));
  afterEach(() => jest.mocked(ExpoSpeechRecognitionModule.isRecognitionAvailable).mockReturnValue(true));

  it('en "Escríbelo como lo dirías"', async () => {
    await render(<AddPantryItemScreen />, { wrapper: withServices(fakeServices()) });
    await fireEvent.press(screen.getByRole('radio', { name: 'Escribir' }));
    expect(screen.getByText(HINT)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Dictar' })).not.toBeOnTheScreen();
  });

  it('y en el asistente', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    await render(<AssistantScreen />, { wrapper: withServices(fakeServices()) });
    expect(screen.getByText(HINT)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Dictar' })).not.toBeOnTheScreen();
  });
});
