import { useEffect, useRef, type RefObject } from 'react';
import { Keyboard, TextInput, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView } from 'react-native';

/** Espacio que queda entre el campo y el teclado. */
const MARGIN = 24;

/**
 * Al abrir el teclado, si el campo en el que se escribe queda debajo, la pantalla se desplaza lo justo para verlo
 * (comentario de la calificación, "Agregar algo más", "¿Cuánto pagaste?"…). Con la ventana edge-to-edge de
 * Android (SDK 57) el sistema ya no lo hace solo. Devuelve el `onScroll` que hay que pasarle al ScrollView.
 */
export function useKeepFocusedInputVisible(scroll: RefObject<ScrollView | null>) {
  const offset = useRef(0);
  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', (event) => {
      const input = TextInput.State.currentlyFocusedInput() as unknown as {
        measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
      } | null;
      if (!input?.measureInWindow || !scroll.current) return;
      const keyboardTop = event.endCoordinates.screenY;
      // Se mide cuando la vista ya se acomodó al teclado (KeyboardAvoidingView).
      setTimeout(() => {
        input.measureInWindow?.((_x, y, _width, height) => {
          const hidden = y + height + MARGIN - keyboardTop;
          if (hidden > 0) scroll.current?.scrollTo({ y: offset.current + hidden, animated: true });
        });
      }, 120);
    });
    return () => subscription.remove();
  }, [scroll]);
  return (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.y;
  };
}
