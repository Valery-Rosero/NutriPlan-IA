import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { flavorColors, MinTouch, Spacing, type FlavorName, type ThemeColors } from '@/shared/theme/colors';
import { Radius, Typography } from '@/shared/theme/tokens';
import { useTheme } from '@/shared/theme/use-theme';
import { AppText, TextLink, type IconName } from '@/shared/ui/primitives';

export type Tone = 'neutral' | 'primary' | 'accent' | 'warning' | 'danger' | 'mango' | 'berry';

/** Fondo y texto de cada tono (siempre un par con contraste AA). */
export function toneColors(c: ThemeColors, tone: Tone) {
  return {
    neutral: { bg: c.surface, fg: c.text },
    primary: { bg: c.primaryContainer, fg: c.onPrimaryContainer },
    accent: { bg: c.accentContainer, fg: c.onAccentContainer },
    warning: { bg: c.warningContainer, fg: c.onWarningContainer },
    danger: { bg: c.dangerContainer, fg: c.onDangerContainer },
    mango: { bg: c.mangoContainer, fg: c.onMangoContainer },
    berry: { bg: c.berryContainer, fg: c.onBerryContainer },
  }[tone];
}

/** Barra de progreso accesible (el lector anuncia el porcentaje). `value` entre 0 y 1. */
export function ProgressBar({ value, label, tone = 'primary' }: { value: number; label: string; tone?: 'primary' | 'warning' | 'accent' }) {
  const c = useTheme();
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: percent, text: `${percent} %` }}
      style={[styles.track, { backgroundColor: c.track }]}>
      <View style={[styles.fill, { width: `${percent}%`, backgroundColor: { primary: c.primary, warning: c.warning, accent: c.accent }[tone] }]} />
    </View>
  );
}

/** Píldora de estado o metadato ("35 min", "Vence pronto"). El significado va en el texto, no solo en el color. */
export function Pill({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const c = useTheme();
  const { bg, fg } = toneColors(c, tone);
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {icon && <Ionicons name={icon} size={14} color={fg} />}
      <Text style={[Typography.caption, styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/** Ícono sobre un cuadrado redondeado de color (identifica secciones y momentos del día). Decorativo. */
export function IconBadge({ name, tone = 'primary', size = 40 }: { name: IconName; tone?: Tone; size?: number }) {
  const c = useTheme();
  const { bg, fg } = toneColors(c, tone);
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.badge, { width: size, height: size, backgroundColor: bg }]}>
      <Ionicons name={name} size={size * 0.5} color={fg} />
    </View>
  );
}

/**
 * Selector de una opción entre pocas (momento del día, secciones). Cada opción es un radio de ≥ 44 pt.
 * La elegida se llena con el sabor de la sección, como la pestaña activa de la barra.
 */
export function SegmentedControl<T extends string>({ options, value, onChange, label, flavor = 'tomato' }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  flavor?: FlavorName;
}) {
  const c = useTheme();
  const f = flavorColors(c, flavor);
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.segmented, { backgroundColor: c.surface }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && { backgroundColor: f.fill }]}>
            {/* Sin límite de líneas: con letra grande (200 %) la opción hace salto de línea en vez de cortarse (US-140). */}
            <Text style={[Typography.label, styles.segmentLabel, { color: selected ? f.onFill : c.textSecondary, fontWeight: selected ? '700' : '600' }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Título de sección con acción opcional a la derecha ("Ver todo"). */
export function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="heading" style={styles.sectionTitle}>{title}</AppText>
      {actionLabel && onAction && <TextLink label={actionLabel} onPress={onAction} />}
    </View>
  );
}

export function Divider() {
  const c = useTheme();
  return <View style={[styles.divider, { backgroundColor: c.divider }]} />;
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs + 1,
    borderRadius: Radius.pill,
  },
  pillText: { fontWeight: '600' },
  badge: { borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  segmented: { flexDirection: 'row', borderRadius: Radius.pill, padding: Spacing.xs, gap: Spacing.xs },
  segmentLabel: { textAlign: 'center' },
  segment: {
    flex: 1,
    minHeight: MinTouch,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  sectionTitle: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
});
