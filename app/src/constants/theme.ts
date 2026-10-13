// Paleta con contraste AA (texto normal ≥ 4.5:1 sobre background y surface) en claro y oscuro.
export const Colors = {
  light: {
    text: '#14211A',
    textSecondary: '#4A5A50',
    background: '#FFFFFF',
    surface: '#F2F6F3',
    border: '#C9D6CD',
    primary: '#1B6B3A',
    onPrimary: '#FFFFFF',
    danger: '#B3261E',
    warning: '#8A5300',
  },
  dark: {
    text: '#EAF2EC',
    textSecondary: '#B4C4B9',
    background: '#0F1712',
    surface: '#1A251E',
    border: '#2F3D34',
    primary: '#7BD49A',
    onPrimary: '#0B2414',
    danger: '#FFB4AB',
    warning: '#F2C14E',
  },
} as const;

export type ThemeColors = { [K in keyof typeof Colors.light]: string };

export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

/** Objetivo táctil mínimo (AGENTS.md regla 9). */
export const MinTouch = 44;
