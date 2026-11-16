import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { Spacing } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';

/**
 * Logo de NutriPlan IA (propuesta de la dueña del producto, 16-nov-2026) con los colores de la app: la hoja en
 * tomate claro, los puntos conectados (la IA) en mora y el corte del color del fondo, para que se vea calado.
 * La palabra va en Manrope ExtraBold (incrustada con expo-font), "NutriPlan" en mora e "IA" en tomate.
 */
export const BRAND_FONT = 'Manrope_800ExtraBold';

const LEAF = 'M60 108C36 92 22 72 22 51 22 27 39 12 61 12c22 0 39 15 39 39 0 21-14 41-40 57Z';
const CUT = 'M45 78c2-23 15-38 34-42-1 23-14 38-34 42Z';
const VEIN = 'M45 78c6-14 17-26 34-42';
const LINKS = 'm43 35 11-7M43 35l-8 11';

/** El símbolo solo (hoja + IA). `inverse`: sobre mora (como el ícono de la app), con puntos y corte claros. */
export function BrandMark({ size = 40, inverse = false }: { size?: number; inverse?: boolean }) {
  const c = useTheme();
  const leaf = c.logoLeaf;
  const dot = inverse ? '#FFF8F1' : c.berry;
  const cut = inverse ? '#FFF8F1' : c.background;
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Path d={LEAF} fill={leaf} />
        <Path d={CUT} fill={cut} />
        <Path d={VEIN} fill="none" stroke={leaf} strokeWidth={3} strokeLinecap="round" />
        <Circle cx={43} cy={35} r={4} fill={dot} />
        <Circle cx={54} cy={28} r={3} fill={dot} />
        <Circle cx={35} cy={46} r={3} fill={dot} />
        <Path d={LINKS} stroke={dot} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

const SIZES = {
  sm: { mark: 28, word: 18, gap: Spacing.xs },
  md: { mark: 40, word: 24, gap: Spacing.sm },
  lg: { mark: 96, word: 40, gap: Spacing.md },
} as const;

/**
 * Logo completo. `horizontal`: símbolo + palabra en una fila (encabezados). `stacked`: símbolo arriba, palabra y,
 * si se pide, el lema (arranque, ingreso). Se anuncia como "NutriPlan IA" (el lema también, si está).
 */
export function BrandLogo({ variant = 'horizontal', size = 'md', tagline = false }: {
  variant?: 'horizontal' | 'stacked';
  size?: keyof typeof SIZES;
  tagline?: boolean;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  const s = SIZES[size];
  const label = tagline ? `${t('brand.name')}. ${t('brand.tagline')}` : t('brand.name');
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[variant === 'horizontal' ? styles.row : styles.column, { gap: s.gap }]}>
      <BrandMark size={s.mark} />
      <View style={variant === 'stacked' ? styles.center : undefined}>
        <Text style={[styles.word, { fontSize: s.word, letterSpacing: -s.word * 0.05, color: c.berry }]}>
          NutriPlan <Text style={{ color: c.tomato }}>IA</Text>
        </Text>
        {tagline && (
          <Text style={[styles.tagline, { color: c.textSecondary, fontSize: Math.max(11, s.word * 0.3) }]}>
            {t('brand.tagline').toUpperCase()}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  column: { alignItems: 'center' },
  center: { alignItems: 'center' },
  word: { fontFamily: BRAND_FONT, includeFontPadding: false },
  tagline: { fontFamily: BRAND_FONT, letterSpacing: 2, marginTop: Spacing.sm, textAlign: 'center' },
});
