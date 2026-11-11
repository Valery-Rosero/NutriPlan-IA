import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AssistantScreen } from '@/features/assistant/ui/assistant-screen';
import { fakeAssistant, fakeServices, withServices } from '@/test/fakes';

describe('Asistente (US-157, US-160, US-173)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ofrece 3 respuestas rápidas y una idea con "Ver receta" (sin comida que cambiar no hay "Aplicar")', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    const assistant = fakeAssistant();
    await render(<AssistantScreen />, { wrapper: withServices(fakeServices({ assistant })) });

    expect(screen.getAllByRole('radio')).toHaveLength(3);
    await fireEvent.press(screen.getByRole('radio', { name: 'Algo solo con lo que tengo' }));

    expect(await screen.findByText('Te propongo un sudado con lo que tienes.')).toBeOnTheScreen();
    expect(assistant.send).toHaveBeenCalledWith({ conversationId: undefined, message: 'Algo solo con lo que tengo', plannedMealId: undefined });
    expect(screen.queryByRole('button', { name: 'Cambiar en mi plan' })).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver receta' }));
    expect(useRouter().push).toHaveBeenCalledWith({ pathname: '/recipe/[id]', params: { id: 'r5' } });
  });

  it('abierto para cambiar una comida, aplica la sugerencia sin salir del chat y sigue la conversación', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ mealId: 'm1', mealTitle: 'Lentejas guisadas' });
    const assistant = fakeAssistant();
    await render(<AssistantScreen />, { wrapper: withServices(fakeServices({ assistant })) });

    expect(screen.getByText('¿Por qué cambiamos "Lentejas guisadas"? Dime qué te provoca o qué no quieres.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Escribe tu pedido'), 'no quiero lentejas');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));

    await fireEvent.press(await screen.findByRole('button', { name: 'Cambiar en mi plan' }));
    await waitFor(() => expect(assistant.apply).toHaveBeenCalledWith(7));
    expect(await screen.findByText('Listo, cambiamos esa comida en tu plan.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Escribe tu pedido'), 'gracias');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() =>
      expect(assistant.send).toHaveBeenLastCalledWith({ conversationId: 'c1', message: 'gracias', plannedMealId: 'm1' }),
    );
  });
});
