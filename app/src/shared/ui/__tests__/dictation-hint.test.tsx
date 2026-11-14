import { fireEvent, render, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { AssistantScreen } from '@/features/assistant/ui/assistant-screen';
import { AddPantryItemScreen } from '@/features/pantry/ui/add-pantry-item-screen';
import { fakeServices, withServices } from '@/test/fakes';

const HINT = '¿Prefieres hablar? Toca el micrófono de tu teclado y díctalo.';

describe('Notas de voz, opción A: dictar con el teclado (pendientes B6-3)', () => {
  it('se recuerda en "Escríbelo como lo dirías"', async () => {
    await render(<AddPantryItemScreen />, { wrapper: withServices(fakeServices()) });
    await fireEvent.press(screen.getByRole('radio', { name: 'Escribir' }));
    expect(screen.getByText(HINT)).toBeOnTheScreen();
  });

  it('y en el asistente', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    await render(<AssistantScreen />, { wrapper: withServices(fakeServices()) });
    expect(screen.getByText(HINT)).toBeOnTheScreen();
  });
});
