import { Colors, type ThemeColors } from '@/shared/theme/colors';

// Contraste WCAG 2.1: (L1 + 0.05) / (L2 + 0.05) con luminancia relativa sRGB.
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

type Key = keyof ThemeColors;
const TEXT: Key[] = ['text', 'textSecondary', 'primary', 'accent', 'success', 'danger', 'warning'];
const BACKGROUNDS: Key[] = ['background', 'surface', 'card'];
/** Cada contenedor de color con el texto que va encima. */
const PAIRS: [Key, Key][] = [
  ['onPrimary', 'primary'],
  ['onPrimaryContainer', 'primaryContainer'],
  ['onAccentContainer', 'accentContainer'],
  ['onDangerContainer', 'dangerContainer'],
  ['onWarningContainer', 'warningContainer'],
  ['primary', 'card'],
  ['onBrand', 'brand'],
  ['onBrandMuted', 'brand'],
  ['onSuccessContainer', 'successContainer'],
  // Los cuatro sabores ("Cocina viva"): relleno con su texto y versión suave con el suyo.
  ['onTomato', 'tomato'],
  ['onTomatoContainer', 'tomatoContainer'],
  ['onBasil', 'basil'],
  ['onBasilContainer', 'basilContainer'],
  ['onMango', 'mango'],
  ['onMangoContainer', 'mangoContainer'],
  ['onBerry', 'berry'],
  ['onBerryContainer', 'berryContainer'],
  // Tarjetas teñidas con el sabor (borrador del plan, sugerencia del asistente): texto normal y secundario.
  ...(['tomatoContainer', 'basilContainer', 'mangoContainer', 'berryContainer'] as const).flatMap(
    (bg) => (['text', 'textSecondary'] as const).map((fg) => [fg, bg] as [Key, Key]),
  ),
];

describe.each(['light', 'dark'] as const)('paleta %s', (mode) => {
  const c = Colors[mode];

  it.each(TEXT.flatMap((fg) => BACKGROUNDS.map((bg) => [fg, bg] as const)))(
    '%s sobre %s cumple AA (≥ 4.5:1)',
    (fg, bg) => {
      expect(contrast(c[fg], c[bg])).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(PAIRS)('%s sobre %s cumple AA (≥ 4.5:1)', (fg, bg) => {
    expect(contrast(c[fg], c[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it('los bordes se distinguen del fondo (≥ 1.3:1, decorativos)', () => {
    expect(contrast(c.border, c.background)).toBeGreaterThanOrEqual(1.3);
  });
});
