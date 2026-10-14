// Paleta de marca: Space Cadet #25344F · Slate Gray #617891 · Tan #D5B893 · Coffee #6F4D38 · Caput Mortuum #632024.
// Los tonos que no alcanzan contraste AA como texto se ajustan (oscurecidos en claro, aclarados en oscuro).
// La prueba shared/theme/__tests__/contrast.test.ts exige ≥ 4.5:1 en todas las combinaciones de texto.
export const Brand = {
  spaceCadet: '#25344F',
  slateGray: '#617891',
  tan: '#D5B893',
  coffee: '#6F4D38',
  caputMortuum: '#632024',
} as const;

/**
 * Colores SEMÁNTICOS: los componentes piden "para qué" (fondo de tarjeta, texto sobre contenedor de alerta…),
 * nunca un hex. Cada `*Container` tiene su `on*Container` (texto encima) con contraste AA garantizado.
 */
export const Colors = {
  light: {
    // texto
    text: Brand.spaceCadet,
    textSecondary: '#4E6378', // slate gray oscurecido: el original da 4.2:1 sobre crema
    // superficies
    background: '#FAF6EF', // crema
    card: '#FFFDF9', // tarjetas elevadas
    surface: '#F1E8DA', // campos, chips, filas
    border: Brand.tan,
    divider: '#E6DACA',
    track: '#E6DACA', // fondo de barras de progreso
    // bloques de marca (como la paleta: Space Cadet con letras Tan)
    brand: Brand.spaceCadet,
    onBrand: Brand.tan,
    onBrandMuted: '#B4C2D3', // slate gray aclarado: legible sobre Space Cadet
    // marca
    primary: Brand.coffee,
    onPrimary: '#FAF6EF',
    primaryContainer: '#EADBC8',
    onPrimaryContainer: '#4A3224',
    accent: Brand.spaceCadet,
    accentContainer: '#DCE3EC',
    onAccentContainer: Brand.spaceCadet,
    // estados
    danger: Brand.caputMortuum,
    dangerContainer: '#F4D9D6',
    onDangerContainer: Brand.caputMortuum,
    warning: '#8A5A12',
    warningContainer: '#F6E7C8',
    onWarningContainer: '#6B4500',
    shadow: '#25344F',
  },
  dark: {
    text: '#F3EBDD',
    textSecondary: '#B4C2D3', // slate gray aclarado
    background: '#141C2B', // space cadet profundo
    card: '#1C2638',
    surface: Brand.spaceCadet,
    border: '#3A4B66',
    divider: '#2C3A52',
    track: '#2F3D55',
    brand: Brand.spaceCadet,
    onBrand: Brand.tan,
    onBrandMuted: '#B4C2D3',
    primary: Brand.tan,
    onPrimary: '#2E1F15', // coffee muy oscuro
    primaryContainer: '#4A3A2C',
    onPrimaryContainer: '#F3E2CC',
    accent: '#9FB2C8',
    accentContainer: '#2C3E5C',
    onAccentContainer: '#DCE6F2',
    danger: '#F2A7AB', // caput mortuum aclarado
    dangerContainer: '#4A2326',
    onDangerContainer: '#F7C6C9',
    warning: '#E8C27A',
    warningContainer: '#4A3A12',
    onWarningContainer: '#F5DFA6',
    shadow: '#000000',
  },
} as const;

export type ThemeColors = { [K in keyof typeof Colors.light]: string };

/** Espaciado en múltiplos de 4. */
export const Spacing = { xxs: 2, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

/** Objetivo táctil mínimo (AGENTS.md regla 9). */
export const MinTouch = 44;
