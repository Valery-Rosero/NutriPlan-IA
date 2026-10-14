import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Escala tipográfica. Los tamaños crecen con el ajuste de fuente del teléfono (accesibilidad):
 * nunca se desactiva allowFontScaling.
 */
export const Typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  subtitle: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: 0.2 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof Typography;

export const Radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

/** Sombras suaves; en Android, `elevation`. El color sale del tema (`shadow`). */
export function elevation(level: 0 | 1 | 2, shadowColor: string): ViewStyle {
  if (level === 0) return {};
  return Platform.select<ViewStyle>({
    android: { elevation: level === 1 ? 2 : 6, shadowColor },
    default: {
      shadowColor,
      shadowOpacity: level === 1 ? 0.08 : 0.14,
      shadowRadius: level === 1 ? 6 : 14,
      shadowOffset: { width: 0, height: level === 1 ? 2 : 6 },
    },
  })!;
}
