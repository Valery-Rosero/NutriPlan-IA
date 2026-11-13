import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Tipografía "Cocina viva": la letra del sistema, que en Android es Roboto (la misma de WhatsApp y Facebook).
 * Ya viene en el teléfono: no hay que cargar fuentes y la app abre más rápido (US-150).
 * Escala un punto más grande que antes para personas mayores. Los tamaños crecen con el ajuste de fuente
 * del teléfono (accesibilidad): nunca se desactiva allowFontScaling.
 */
export const Typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.4 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  subtitle: { fontSize: 18, lineHeight: 24, fontWeight: '500' },
  body: { fontSize: 17, lineHeight: 25, fontWeight: '400' },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: 0.1 },
  caption: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof Typography;

/** Esquinas: tarjetas 20, botones 16, chips y píldoras redondas. */
export const Radius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, pill: 999 } as const;

/** Sombras suaves y cálidas; en Android, `elevation`. El color sale del tema (`shadow`). */
export function elevation(level: 0 | 1 | 2, shadowColor: string): ViewStyle {
  if (level === 0) return {};
  return Platform.select<ViewStyle>({
    android: { elevation: level === 1 ? 2 : 8, shadowColor },
    default: {
      shadowColor,
      shadowOpacity: level === 1 ? 0.08 : 0.16,
      shadowRadius: level === 1 ? 8 : 18,
      shadowOffset: { width: 0, height: level === 1 ? 2 : 8 },
    },
  })!;
}
