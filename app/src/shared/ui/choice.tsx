import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { flavorColors, MinTouch, Spacing, type FlavorName } from '@/shared/theme/colors';
import { Radius, Typography } from '@/shared/theme/tokens';
import { useTheme } from '@/shared/theme/use-theme';

/**
 * Opción seleccionable. `multiple` = casilla; si no, botón de opción única.
 * `removable`: elegida, muestra una ✕ y tocarla la quita (por ejemplo, ingredientes de una receta).
 */
export function Chip({ label, selected, onPress, multiple, removable, flavor = 'tomato' }: {
  label: string;
  selected: boolean;
  onPress: () => void;
  multiple?: boolean;
  removable?: boolean;
  /** Sabor al elegirla (receta: lo que tienes en albahaca, lo que hay que comprar en mango). */
  flavor?: FlavorName;
}) {
  const c = useTheme();
  const f = flavorColors(c, flavor);
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={multiple ? { checked: selected } : { selected }}
      accessibilityLabel={label}
      accessibilityHint={removable && selected ? t('common.tapToRemove') : undefined}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: selected ? f.fill : c.border, backgroundColor: selected ? f.fill : c.surface },
      ]}>
      {selected && <Ionicons name="checkmark" size={16} color={f.onFill} />}
      <Text style={[styles.chipLabel, { color: selected ? f.onFill : c.text }]}>{label}</Text>
      {removable && selected && <Ionicons name="close-circle" size={18} color={f.onFill} />}
    </Pressable>
  );
}

export function ChipGroup({ children }: { children: React.ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

/** Contador con botones de 44 pt y el valor anunciado por el lector de pantalla. */
export function Stepper({ label, value, min, max, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  const button = (delta: number, icon: 'remove' | 'add', a11y: string) => {
    const disabled = value + delta < min || value + delta > max;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${a11y}: ${label}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => onChange(value + delta)}
        style={[styles.stepButton, { borderColor: c.primary, opacity: disabled ? 0.4 : 1 }]}>
        <Ionicons name={icon} size={22} color={c.primary} />
      </Pressable>
    );
  };
  return (
    <View style={styles.stepper}>
      <Text style={[styles.stepLabel, { color: c.text }]}>{label}</Text>
      <View style={styles.stepRow}>
        {button(-1, 'remove', t('common.decrease'))}
        <Text accessibilityLiveRegion="polite" style={[styles.stepValue, { color: c.text }]}>{value}</Text>
        {button(1, 'add', t('common.increase'))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    minHeight: MinTouch,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  chipLabel: { ...Typography.label, fontSize: 15 },
  stepper: { gap: Spacing.xs },
  stepLabel: Typography.subtitle,
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepButton: { width: MinTouch, height: MinTouch, borderRadius: Radius.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepValue: { ...Typography.title, minWidth: 40, textAlign: 'center' },
});
