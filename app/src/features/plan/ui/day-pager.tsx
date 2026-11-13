import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Dimensions, FlatList, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import type { CalendarDay } from '@/features/plan/domain/calendar';
import { useReduceMotion } from '@/shared/hooks/use-reduce-motion';
import { Spacing } from '@/shared/theme/colors';

/**
 * El "libro" de Mi semana (B1): una página por día; se pasa deslizando a los lados.
 * La página que se va gira sobre su borde izquierdo, como una hoja. Con "reducir movimiento", sin giro.
 * `index` lo controla quien la usa (el calendario de arriba y los botones de la página lo cambian).
 */
export function DayPager({ days, index, onIndexChange, renderDay }: {
  days: CalendarDay[];
  index: number;
  onIndexChange: (index: number) => void;
  renderDay: (day: CalendarDay, index: number) => ReactNode;
}) {
  // Ancho inicial estimado (pantalla menos márgenes); se corrige al medir.
  const [width, setWidth] = useState(() => Dimensions.get('window').width - Spacing.md * 2);
  const [scrollX] = useState(() => new Animated.Value(index * width)); // se crea una sola vez
  const list = useRef<FlatList<CalendarDay>>(null);
  const shown = useRef(index);
  const reduceMotion = useReduceMotion();

  // El calendario (o un botón) cambió el día: pasar a esa página.
  useEffect(() => {
    if (index === shown.current) return;
    shown.current = index;
    list.current?.scrollToOffset({ offset: index * width, animated: !reduceMotion });
  }, [index, width, reduceMotion]);

  const onLayout = (e: LayoutChangeEvent) => {
    const measured = Math.round(e.nativeEvent.layout.width);
    if (measured > 0 && measured !== width) {
      setWidth(measured);
      requestAnimationFrame(() => list.current?.scrollToOffset({ offset: shown.current * measured, animated: false }));
    }
  };

  return (
    <View onLayout={onLayout} style={styles.root}>
      <Animated.FlatList
        ref={list}
        data={days}
        keyExtractor={(d) => d.date}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        // Pocas páginas (máximo un mes) y livianas: se dibujan todas para que pasar sea inmediato.
        initialNumToRender={days.length}
        contentOffset={{ x: index * width, y: 0 }}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        onMomentumScrollEnd={(e) => {
          const next = Math.max(0, Math.min(days.length - 1, Math.round(e.nativeEvent.contentOffset.x / width)));
          if (next !== shown.current) {
            shown.current = next;
            onIndexChange(next);
          }
        }}
        renderItem={({ item, index: i }) => (
          <Page width={width} position={i} scrollX={scrollX} flat={reduceMotion}>
            {renderDay(item, i)}
          </Page>
        )}
      />
    </View>
  );
}

function Page({ width, position, scrollX, flat, children }: {
  width: number;
  position: number;
  scrollX: Animated.Value;
  flat: boolean;
  children: ReactNode;
}) {
  if (flat) return <View style={[styles.page, { width }]}>{children}</View>;
  const inputRange = [(position - 1) * width, position * width, (position + 1) * width];
  // Al salir hacia la izquierda la hoja se dobla sobre su borde; al entrar, se asienta.
  const rotateY = scrollX.interpolate({ inputRange, outputRange: ['0deg', '0deg', '-32deg'], extrapolate: 'clamp' });
  const scale = scrollX.interpolate({ inputRange, outputRange: [0.94, 1, 0.97], extrapolate: 'clamp' });
  const opacity = scrollX.interpolate({ inputRange, outputRange: [0.7, 1, 0.55], extrapolate: 'clamp' });
  return (
    <Animated.View style={[styles.page, { width, opacity, transform: [{ perspective: 1200 }, { rotateY }, { scale }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch' },
  page: { transformOrigin: 'left center', paddingHorizontal: Spacing.xxs },
});
