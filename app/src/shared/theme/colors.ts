// Paleta "Cocina viva" (propuesta aprobada el 13-nov-2026): cuatro sabores de la cocina colombiana sobre
// neutros cálidos. Tomate (acción, Hoy, Receta), Albahaca (lo fresco, "lo tienes", Mi cocina), Mango (el día y
// el plan, "para comprar", Mi semana) y Mora (el asistente). El azul marino sale: es el color que menos
// apetito despierta. La prueba shared/theme/__tests__/contrast.test.ts exige ≥ 4.5:1 en todo texto.
export const Flavor = {
  tomato: '#BC3F0B', // un punto más profundo que #C2410C: así también pasa AA como texto sobre "avena"
  basil: '#2F7A3E',
  mango: '#F2B21B',
  berry: '#8A3E7A',
} as const;

/**
 * Colores SEMÁNTICOS: los componentes piden "para qué" (fondo de tarjeta, texto sobre contenedor de alerta…),
 * nunca un hex. Cada `*Container` tiene su `on*Container` (texto encima) con contraste AA garantizado.
 */
export const Colors = {
  light: {
    // texto
    text: '#2B211C', // cacao
    textSecondary: '#6A584C', // canela
    // superficies
    background: '#FFF8F1', // harina
    card: '#FFFFFF', // leche
    surface: '#F6ECE1', // avena: campos, chips, filas
    border: '#D9C3AD',
    divider: '#EFE2D4',
    track: '#EFE2D4', // fondo de barras de progreso
    // bloques de marca (se usan poco: los encabezados ahora son claros)
    brand: Flavor.tomato,
    onBrand: '#FFFFFF',
    onBrandMuted: '#FFF1E8',
    // acción principal = tomate
    primary: Flavor.tomato,
    onPrimary: '#FFFFFF',
    primaryContainer: '#FFE6D6',
    onPrimaryContainer: '#7C2D0B',
    // acento = albahaca (lo fresco, lo que tienes, lo que salió bien)
    accent: Flavor.basil,
    accentContainer: '#DDF3E1',
    onAccentContainer: '#1D5129',
    success: Flavor.basil,
    successContainer: '#DDF3E1',
    onSuccessContainer: '#1D5129',
    // estados
    danger: '#B42318',
    dangerContainer: '#FDE4E1',
    onDangerContainer: '#8A1C12',
    warning: '#8A5300', // mango oscurecido para texto
    warningContainer: '#FFF0C7',
    onWarningContainer: '#6E4A00',
    // sabores por sección (relleno con su texto encima, y versión suave)
    tomato: Flavor.tomato,
    onTomato: '#FFFFFF',
    tomatoContainer: '#FFE6D6',
    onTomatoContainer: '#7C2D0B',
    basil: Flavor.basil,
    onBasil: '#FFFFFF',
    basilContainer: '#DDF3E1',
    onBasilContainer: '#1D5129',
    mango: Flavor.mango,
    onMango: '#3B2A00',
    mangoContainer: '#FFF0C7',
    onMangoContainer: '#6E4A00',
    berry: Flavor.berry,
    onBerry: '#FFFFFF',
    berryContainer: '#F6E3F1',
    onBerryContainer: '#5E2853',
    shadow: '#5C3A24', // sombra cálida
  },
  dark: {
    // De noche la cocina no se vuelve azul: café tostado, y los sabores se aclaran (texto oscuro encima).
    text: '#F7EEE6',
    textSecondary: '#CDBBAE',
    background: '#17120F',
    card: '#221B17',
    surface: '#2D241F',
    border: '#5A4A3E',
    divider: '#3A2F28',
    track: '#3A2F28',
    brand: '#FF8A5C',
    onBrand: '#2A0E02',
    onBrandMuted: '#4A1A06',
    primary: '#FF8A5C',
    onPrimary: '#2A0E02',
    primaryContainer: '#4A2414',
    onPrimaryContainer: '#FFD3BE',
    accent: '#7FD08E',
    accentContainer: '#183A22',
    onAccentContainer: '#C3EFCB',
    success: '#7FD08E',
    successContainer: '#183A22',
    onSuccessContainer: '#C3EFCB',
    danger: '#FF8F85',
    dangerContainer: '#4A1A16',
    onDangerContainer: '#FFD0CB',
    warning: '#FFC94D',
    warningContainer: '#3F3008',
    onWarningContainer: '#FFE6A3',
    tomato: '#FF8A5C',
    onTomato: '#2A0E02',
    tomatoContainer: '#4A2414',
    onTomatoContainer: '#FFD3BE',
    basil: '#7FD08E',
    onBasil: '#082911',
    basilContainer: '#183A22',
    onBasilContainer: '#C3EFCB',
    mango: '#FFC94D',
    onMango: '#2B1E00',
    mangoContainer: '#3F3008',
    onMangoContainer: '#FFE6A3',
    berry: '#E39AD3',
    onBerry: '#2E0D27',
    berryContainer: '#40203A',
    onBerryContainer: '#F8D3EF',
    shadow: '#000000',
  },
} as const;

export type ThemeColors = { [K in keyof typeof Colors.light]: string };

/** Los cuatro sabores: cada sección de la app tiene el suyo. */
export type FlavorName = 'tomato' | 'basil' | 'mango' | 'berry';

/** Relleno, texto encima, versión suave y su texto, de un sabor en el tema actual. */
export function flavorColors(c: ThemeColors, flavor: FlavorName) {
  const cap = (flavor.charAt(0).toUpperCase() + flavor.slice(1)) as 'Tomato' | 'Basil' | 'Mango' | 'Berry';
  return {
    fill: c[flavor],
    onFill: c[`on${cap}`],
    container: c[`${flavor}Container`],
    onContainer: c[`on${cap}Container`],
  };
}

/** Espaciado en múltiplos de 4. */
export const Spacing = { xxs: 2, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

/** Objetivo táctil mínimo (AGENTS.md regla 9). Los botones principales usan 52. */
export const MinTouch = 44;
export const ButtonHeight = 52;
