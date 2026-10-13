import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { MinTouch, Spacing } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';

/** Opción seleccionable. `multiple` = casilla; si no, botón de opción única. */
export function Chip({ label, selected, onPress, multiple }: {
  label: string;
  selected: boolean;
  onPress: () => void;
  multiple?: boolean;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={multiple ? { checked: selected } : { selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primary : c.surface },
      ]}>
      {selected && <Ionicons name="checkmark" size={16} color={c.onPrimary} />}
      <Text style={[styles.chipLabel, { color: selected ? c.onPrimary : c.text }]}>{label}</Text>
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
    borderRadius: 22,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  chipLabel: { fontSize: 16 },
  stepper: { gap: Spacing.xs },
  stepLabel: { fontSize: 16, fontWeight: '600' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepButton: { width: MinTouch, height: MinTouch, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontSize: 24, fontWeight: '700', minWidth: 40, textAlign: 'center' },
});
