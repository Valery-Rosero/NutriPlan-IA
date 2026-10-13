// Paleta de marca: Space Cadet #25344F · Slate Gray #617891 · Tan #D5B893 · Coffee #6F4D38 · Caput Mortuum #632024.
// Los tonos que no alcanzan contraste AA como texto se ajustan (oscurecidos en claro, aclarados en oscuro).
// La prueba src/constants/__tests__/theme.test.ts exige ≥ 4.5:1 en todas las combinaciones de texto.
export const Brand = {
  spaceCadet: '#25344F',
  slateGray: '#617891',
  tan: '#D5B893',
  coffee: '#6F4D38',
  caputMortuum: '#632024',
} as const;

export const Colors = {
  light: {
    text: Brand.spaceCadet,
    textSecondary: '#4E6378', // slate gray oscurecido: el original da 4.2:1 sobre crema
    background: '#FAF6EF', // crema
    surface: '#F1E8DA', // tan muy claro
    border: Brand.tan,
    primary: Brand.coffee,
    onPrimary: '#FAF6EF',
    accent: Brand.spaceCadet,
    danger: Brand.caputMortuum,
    warning: '#8A5A12',
  },
  dark: {
    text: '#F3EBDD',
    textSecondary: '#B4C2D3', // slate gray aclarado
    background: '#141C2B', // space cadet profundo
    surface: Brand.spaceCadet,
    border: '#3A4B66',
    primary: Brand.tan,
    onPrimary: '#2E1F15', // coffee muy oscuro
    accent: '#9FB2C8',
    danger: '#F2A7AB', // caput mortuum aclarado
    warning: '#E8C27A',
  },
} as const;

export type ThemeColors = { [K in keyof typeof Colors.light]: string };

export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

/** Objetivo táctil mínimo (AGENTS.md regla 9). */
export const MinTouch = 44;
