import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/** Títulos en serif, como la paleta de marca. Se carga en app/_layout.tsx; si falla, se usa la del sistema. */
export const DisplayFont = 'DMSerifDisplay_400Regular';

/**
 * Escala tipográfica. Los tamaños crecen con el ajuste de fuente del teléfono (accesibilidad):
 * nunca se desactiva allowFontScaling.
 */
export const Typography = {
  display: { fontFamily: DisplayFont, fontSize: 34, lineHeight: 40, fontWeight: '400' },
  title: { fontFamily: DisplayFont, fontSize: 28, lineHeight: 34, fontWeight: '400' },
  heading: { fontFamily: DisplayFont, fontSize: 21, lineHeight: 27, fontWeight: '400' },
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
