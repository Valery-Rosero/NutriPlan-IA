import { renderHook } from '@testing-library/react-native';
import { Keyboard, TextInput, type ScrollView } from 'react-native';

import { useKeepFocusedInputVisible } from '@/shared/hooks/use-keep-focused-visible';

describe('el teclado no tapa el campo en el que se escribe', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('si el campo queda debajo del teclado, la pantalla baja lo justo para verlo', async () => {
    let onShow: ((e: { endCoordinates: { screenY: number } }) => void) | undefined;
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((_name: string, listener: never) => {
      onShow = listener;
      return { remove: jest.fn() };
    }) as never);
    // El comentario de la calificación está en y = 700 (alto 40); el teclado empieza en y = 600.
    jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue({
      measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(0, 700, 300, 40),
    } as never);
    const scrollTo = jest.fn();
    const ref = { current: { scrollTo } as unknown as ScrollView };
    const { result } = await renderHook(() => useKeepFocusedInputVisible(ref));
    result.current({ nativeEvent: { contentOffset: { y: 200 } } } as never); // ya iba desplazada 200

    onShow?.({ endCoordinates: { screenY: 600 } });
    jest.advanceTimersByTime(200);
    expect(scrollTo).toHaveBeenCalledWith({ y: 200 + (700 + 40 + 24 - 600), animated: true });
  });

  it('si el campo ya se ve, no se mueve nada', async () => {
    let onShow: ((e: { endCoordinates: { screenY: number } }) => void) | undefined;
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((_name: string, listener: never) => {
      onShow = listener;
      return { remove: jest.fn() };
    }) as never);
    jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue({
      measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(0, 300, 300, 40),
    } as never);
    const scrollTo = jest.fn();
    await renderHook(() => useKeepFocusedInputVisible({ current: { scrollTo } as unknown as ScrollView }));
    onShow?.({ endCoordinates: { screenY: 600 } });
    jest.advanceTimersByTime(200);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
