import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { tidyChatMarkdown } from '@/features/assistant/domain/assistant';
import { AssistantScreen } from '@/features/assistant/ui/assistant-screen';
import { fakeAssistant, fakeRecipes, fakeServices, RECIPE, withServices } from '@/test/fakes';

describe('Asistente v2 · IA primero (ADR-037)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('IA-1: responde con una lista de platos (nombre, frase y minutos), no con 2 recetas largas', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    const assistant = fakeAssistant();
    await render(<AssistantScreen />, { wrapper: withServices(fakeServices({ assistant })) });

    await fireEvent.press(screen.getByRole('radio', { name: 'Algo solo con lo que tengo' }));
    expect(assistant.send).toHaveBeenCalledWith({ conversationId: undefined, message: 'Algo solo con lo que tengo', plannedMealId: undefined });
    expect(await screen.findByText('Con lo que tienes, mira:')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sudado de pollo con papa. Jugoso, de una sola olla. 40 min.' })).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: /min\.$/ })).toHaveLength(4);
    expect(assistant.fill).not.toHaveBeenCalled(); // nada se arma hasta elegir
  });

  it('IA-2: al elegir uno, la IA llena la receta y se ve completa: porciones, nutrición y costo de la base, ingredientes y pasos', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    const assistant = fakeAssistant();
    const recipes = fakeRecipes({ getDetail: jest.fn(async () => ({ ...RECIPE, id: 'ia1', title: 'Arroz atollado', byAssistant: true, groups: [], extras: [{ name: 'Chontaduro', grams: 120 }] })) });
    await render(<AssistantScreen />, { wrapper: withServices(fakeServices({ assistant, recipes })) });
    await fireEvent.changeText(screen.getByLabelText('Escribe tu pedido'), '¿Qué hago de almuerzo?');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));

    await fireEvent.press(await screen.findByRole('button', { name: /^Arroz atollado\./ }));
    expect(assistant.fill).toHaveBeenCalledWith('c1', 7, 1);
    expect(await screen.findByText('4 porciones · 40 min')).toBeOnTheScreen();
    expect(screen.getByText('420 kcal')).toBeOnTheScreen();
    expect(screen.getByText('25 g proteína')).toBeOnTheScreen();
    expect(screen.getByText('≈ $ 14.800')).toBeOnTheScreen();
    expect(screen.getByText('• Arroz blanco · 300 g — falta')).toBeOnTheScreen();
    expect(screen.getByText('• Chontaduro · 120 g — falta')).toBeOnTheScreen(); // ingrediente libre (ADR-037)
    expect(screen.getByText('1. Cocina el arroz.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Ver receta completa y cocinarla' }));
    expect(useRouter().push).toHaveBeenCalledWith({ pathname: '/recipe/[id]', params: { id: 'ia1' } });
  });

  it('IA-2: lo que falta (también lo libre) va a la lista de una vez', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    const recipes = fakeRecipes({ getDetail: jest.fn(async () => ({ ...RECIPE, id: 'ia1', groups: [], extras: [{ name: 'Chontaduro', grams: 120 }] })) });
    const services = fakeServices({ recipes });
    await render(<AssistantScreen />, { wrapper: withServices(services) });
    await fireEvent.changeText(screen.getByLabelText('Escribe tu pedido'), 'almuerzo');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
    await fireEvent.press(await screen.findByRole('button', { name: /^Arroz atollado\./ }));

    await fireEvent.press(await screen.findByRole('button', { name: 'Agregar lo que falta a mi lista (2)' }));
    await waitFor(() => expect(services.shopping.addIngredients).toHaveBeenCalledWith('list1', [{ ingredientId: 'arroz', grams: 300 }]));
    await waitFor(() => expect(services.shopping.addManual).toHaveBeenCalledWith('list1', 'Chontaduro', 3));
  });

  it('abierto para cambiar una comida: elige un plato, se arma y lo aplica sin salir del chat', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ mealId: 'm1', mealTitle: 'Lentejas guisadas' });
    const assistant = fakeAssistant({
      fill: jest.fn(async () => ({
        recipeId: 'ia1', title: 'Arroz atollado', totalMinutes: 45, coverage: 0.5, missing: [], byAssistant: true, targetPlannedMealId: 'm1',
      })),
    });
    await render(<AssistantScreen />, { wrapper: withServices(fakeServices({ assistant })) });

    expect(screen.getByText('¿Por qué cambiamos "Lentejas guisadas"? Dime qué te provoca o qué no quieres.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Escribe tu pedido'), 'no quiero lentejas');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
    await fireEvent.press(await screen.findByRole('button', { name: /^Arroz atollado\./ }));

    await fireEvent.press(await screen.findByRole('button', { name: 'Cambiar en mi plan' }));
    await waitFor(() => expect(assistant.apply).toHaveBeenCalledWith(7, 'ia1'));
    expect(await screen.findByText('Listo, cambiamos esa comida en tu plan.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Cambiar en mi plan' })).not.toBeOnTheScreen();
  });

  it('si no se pudo armar esa receta, lo dice y se puede elegir otra', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    const { AppError } = jest.requireActual('@/core/errors/app-error');
    const assistant = fakeAssistant({ fill: jest.fn(async () => { throw new AppError('recipe_not_created'); }) });
    await render(<AssistantScreen />, { wrapper: withServices(fakeServices({ assistant })) });
    await fireEvent.changeText(screen.getByLabelText('Escribe tu pedido'), 'almuerzo');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
    await fireEvent.press(await screen.findByRole('button', { name: /^Tortilla de papa\./ }));
    expect(await screen.findByText('No pude armar esa receta. Prueba con otro plato de la lista.')).toBeOnTheScreen();
  });

  it('si el asistente no propone nada (p. ej. una pregunta de salud), no muestra platos', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    const assistant = fakeAssistant({
      send: jest.fn(async () => ({
        conversationId: 'c1', messageId: 8, reply: 'Eso consúltalo con un profesional.', fallback: false, ideas: [],
        targetPlannedMealId: null, suggestions: [], week: null, hasPlan: true,
      })),
    });
    await render(<AssistantScreen />, { wrapper: withServices(fakeServices({ assistant })) });
    await fireEvent.changeText(screen.getByLabelText('Escribe tu pedido'), '¿puedo comer sal?');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('Eso consúltalo con un profesional.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /min\.$/ })).not.toBeOnTheScreen();
  });

  it('IA-6: sin IA, las ideas son del recetario y lo dice', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    const assistant = fakeAssistant({
      send: jest.fn(async () => ({
        conversationId: 'c1', messageId: 9, reply: 'Ahora no me pude conectar con la IA. Te dejo ideas del recetario:', fallback: true,
        ideas: [{ title: 'Sudado de lo que haya', blurb: 'Tienes todo lo necesario.', minutes: 40, fromCatalog: true }],
        targetPlannedMealId: null, suggestions: [], week: null, hasPlan: false,
      })),
    });
    await render(<AssistantScreen />, { wrapper: withServices(fakeServices({ assistant })) });
    await fireEvent.changeText(screen.getByLabelText('Escribe tu pedido'), 'almuerzo');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('Del recetario')).toBeOnTheScreen();
  });
});

describe('IA-7 · las listas del chat se leen como lista', () => {
  it('separa una lista escrita en una sola línea', () => {
    expect(tidyChatMarkdown('Te propongo: - **Sudado** con papa - **Arroz** atollado')).toBe('Te propongo:\n- **Sudado** con papa\n- **Arroz** atollado');
    expect(tidyChatMarkdown('Opciones: 1. **Sudado** 2. **Arroz**')).toBe('Opciones:\n1. **Sudado**\n2. **Arroz**');
    expect(tidyChatMarkdown('Normal, sin lista.')).toBe('Normal, sin lista.');
  });
});
