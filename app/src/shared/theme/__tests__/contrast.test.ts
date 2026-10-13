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

const TEXT: (keyof ThemeColors)[] = ['text', 'textSecondary', 'primary', 'accent', 'danger', 'warning'];
const BACKGROUNDS: (keyof ThemeColors)[] = ['background', 'surface'];

describe.each(['light', 'dark'] as const)('paleta %s', (mode) => {
  const c = Colors[mode];

  it.each(TEXT.flatMap((fg) => BACKGROUNDS.map((bg) => [fg, bg] as const)))(
    '%s sobre %s cumple AA (≥ 4.5:1)',
    (fg, bg) => {
      expect(contrast(c[fg], c[bg])).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('el texto de los botones cumple AA sobre primary', () => {
    expect(contrast(c.onPrimary, c.primary)).toBeGreaterThanOrEqual(4.5);
  });
});
