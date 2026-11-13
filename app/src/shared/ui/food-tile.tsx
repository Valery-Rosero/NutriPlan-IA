import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { flavorColors, type FlavorName } from '@/shared/theme/colors';
import { Radius } from '@/shared/theme/tokens';
import { useTheme } from '@/shared/theme/use-theme';

/**
 * El plato o ingrediente como emoji sobre un fondo suave del sabor (ocupa el lugar de la foto).
 * Decorativo: el lector no lo anuncia porque el nombre siempre está al lado.
 * `size` es el lado del cuadrado; con `wide` ocupa todo el ancho (plato destacado de Hoy y de la receta).
 */
export function FoodTile({ emoji, flavor = 'tomato', size = 48, wide = false, style }: {
  emoji: string;
  flavor?: FlavorName;
  size?: number;
  wide?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const f = flavorColors(c, flavor);
  const glyph = Math.round(size * (wide ? 0.55 : 0.58));
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        styles.tile,
        { backgroundColor: f.container, height: size, borderRadius: size >= 96 ? Radius.xl : Radius.md },
        wide ? styles.wide : { width: size },
        style,
      ]}>
      {/* Adorno: no crece con la letra del sistema para no desbordar su cuadro. */}
      <Text maxFontSizeMultiplier={1} style={{ fontSize: glyph, lineHeight: Math.round(glyph * 1.2) }}>
        {emoji}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
  wide: { alignSelf: 'stretch' },
});
