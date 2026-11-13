import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AssistantScreen } from '@/features/assistant/ui/assistant-screen';
import { fakeAssistant, fakeServices, withServices } from '@/test/fakes';

describe('Asistente (US-157, US-160, US-173, ADR-029)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('responde con formato y varias opciones: del recetario y creadas por el asistente', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    const assistant = fakeAssistant();
    await render(<AssistantScreen />, { wrapper: withServices(fakeServices({ assistant })) });

    expect(screen.getAllByRole('radio')).toHaveLength(3);
    await fireEvent.press(screen.getByRole('radio', { name: 'Algo solo con lo que tengo' }));
    expect(assistant.send).toHaveBeenCalledWith({ conversationId: undefined, message: 'Algo solo con lo que tengo', plannedMealId: undefined });

    // El Markdown se lee como texto: la lista y la negrita, sin asteriscos.
    expect(await screen.findByText('Te tengo dos ideas:')).toBeOnTheScreen();
    expect(screen.queryByText(/\*\*/)).not.toBeOnTheScreen();

    // Dos tarjetas: una del recetario y una receta del asistente con lo que falta comprar.
    expect(screen.getByText('Del recetario')).toBeOnTheScreen();
    expect(screen.getByText('Receta del asistente')).toBeOnTheScreen();
    expect(screen.getByText('Para comprar: Pechuga de pollo')).toBeOnTheScreen();
    expect(screen.getByText('Creada por el asistente: revísala antes de cocinar.')).toBeOnTheScreen();

    // Sin comida que cambiar no hay "Cambiar en mi plan"; cada tarjeta abre su receta.
    expect(screen.queryByRole('button', { name: 'Cambiar en mi plan' })).not.toBeOnTheScreen();
    const [, second] = screen.getAllByRole('button', { name: 'Ver receta' });
    await fireEvent.press(second);
    expect(useRouter().push).toHaveBeenCalledWith({ pathname: '/recipe/[id]', params: { id: 'ia1' } });
  });

  it('abierto para cambiar una comida, aplica LA opción elegida sin salir del chat y sigue la conversación', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ mealId: 'm1', mealTitle: 'Lentejas guisadas' });
    const assistant = fakeAssistant();
    await render(<AssistantScreen />, { wrapper: withServices(fakeServices({ assistant })) });

    expect(screen.getByText('¿Por qué cambiamos "Lentejas guisadas"? Dime qué te provoca o qué no quieres.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Escribe tu pedido'), 'no quiero lentejas');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));

    const applyButtons = await screen.findAllByRole('button', { name: 'Cambiar en mi plan' });
    expect(applyButtons).toHaveLength(2);
    await fireEvent.press(applyButtons[1]);
    await waitFor(() => expect(assistant.apply).toHaveBeenCalledWith(7, 'ia1'));
    expect(await screen.findByText('Listo, cambiamos esa comida en tu plan.')).toBeOnTheScreen();
    // Ya aplicada una, no se ofrece aplicar las demás.
    expect(screen.queryByRole('button', { name: 'Cambiar en mi plan' })).not.toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Escribe tu pedido'), 'gracias');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() =>
      expect(assistant.send).toHaveBeenLastCalledWith({ conversationId: 'c1', message: 'gracias', plannedMealId: 'm1' }),
    );
  });

  it('si el asistente no propone nada (p. ej. una pregunta de salud), no muestra tarjetas', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    const assistant = fakeAssistant({
      send: jest.fn(async () => ({
        conversationId: 'c1', messageId: 8, reply: 'Eso consúltalo con un profesional.', fallback: false, suggestions: [], week: null, hasPlan: true,
      })),
    });
    await render(<AssistantScreen />, { wrapper: withServices(fakeServices({ assistant })) });
    await fireEvent.changeText(screen.getByLabelText('Escribe tu pedido'), '¿puedo comer sal?');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('Eso consúltalo con un profesional.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Ver receta' })).not.toBeOnTheScreen();
  });
});
