import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { useReduceMotion } from '@/shared/hooks/use-reduce-motion';
import { useTheme } from '@/shared/theme/use-theme';
import { BrandLogo } from '@/shared/ui/brand-logo';

/**
 * Arranque con el logo principal. Android 12+ recorta el arranque del sistema en un círculo (solo cabe el
 * símbolo), así que, apenas carga la app, esta pantalla sigue con el logo completo y el lema mientras se abre la
 * sesión. Mismo fondo que el arranque del sistema: el paso de uno a otro no se nota.
 */
export function BrandSplash() {
  const c = useTheme();
  const reduceMotion = useReduceMotion();
  const [appear] = useState(() => new Animated.Value(reduceMotion ? 1 : 0)); // se crea una sola vez
  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(appear, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, [appear, reduceMotion]);
  return (
    <View style={[styles.root, { backgroundColor: c.background }]} testID="brand-splash">
      <Animated.View
        style={{ opacity: appear, transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
        <BrandLogo variant="stacked" size="lg" tagline />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
