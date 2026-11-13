import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Keyboard } from 'react-native';

import '@/infrastructure/i18n';
import { FloatingTabBar, type TabSpec } from '@/shared/ui/floating-tab-bar';

const TABS: Record<string, TabSpec> = {
  index: { label: 'tabs.today', icon: 'restaurant-outline', iconActive: 'restaurant', flavor: 'tomato' },
  kitchen: { label: 'tabs.kitchen', icon: 'basket-outline', iconActive: 'basket', flavor: 'basil' },
  week: { label: 'tabs.week', icon: 'calendar-outline', iconActive: 'calendar', flavor: 'mango' },
  assistant: { label: 'tabs.assistant', icon: 'sparkles-outline', iconActive: 'sparkles', flavor: 'berry' },
};
const routes = ['index', 'kitchen', 'week', 'assistant'].map((name) => ({ key: `${name}-k`, name, params: name === 'assistant' ? { mealId: 'm1' } : undefined }));

async function setup(index = 0) {
  const navigation = { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() };
  const utils = await render(
    <FloatingTabBar state={{ index, routes }} navigation={navigation} tabs={TABS} resetParams={{ assistant: { mealId: undefined } }} />,
  );
  return { navigation, ...utils };
}

describe('Barra flotante "Cocina viva"', () => {
  it('muestra las cuatro pestañas con su nombre y marca la activa', async () => {
    await setup(2);
    expect(screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel)).toEqual(['Hoy', 'Mi cocina', 'Mi semana', 'Asistente']);
    expect(screen.getByRole('tab', { name: 'Mi semana' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Hoy' })).not.toBeSelected();
  });

  it('tocar una pestaña avisa al navegador y navega; tocar la activa no hace nada', async () => {
    const { navigation } = await setup(0);
    await fireEvent.press(screen.getByRole('tab', { name: 'Mi cocina' }));
    expect(navigation.emit).toHaveBeenCalledWith({ type: 'tabPress', target: 'kitchen-k', canPreventDefault: true });
    expect(navigation.navigate).toHaveBeenCalledWith('kitchen', undefined);
    navigation.navigate.mockClear();
    await fireEvent.press(screen.getByRole('tab', { name: 'Hoy' }));
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('el asistente abierto desde la barra empieza sin la comida de una vez anterior', async () => {
    const { navigation } = await setup(0);
    await fireEvent.press(screen.getByRole('tab', { name: 'Asistente' }));
    expect(navigation.navigate).toHaveBeenCalledWith('assistant', { mealId: undefined });
  });

  it('se esconde con el teclado abierto y vuelve al cerrarlo', async () => {
    const listeners: Record<string, () => void> = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: () => void) => {
      listeners[event] = cb;
      return { remove: jest.fn() };
    }) as unknown as typeof Keyboard.addListener);
    await setup(0);
    await act(async () => listeners.keyboardDidShow());
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    await act(async () => listeners.keyboardDidHide());
    expect(screen.getAllByRole('tab')).toHaveLength(4);
  });
});
