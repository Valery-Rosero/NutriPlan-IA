import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

import { MinTouch } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';
import type { IconName } from '@/shared/ui/primitives';

type IconTone = 'default' | 'secondary' | 'primary' | 'danger' | 'onBrand';

/** Botón de solo ícono con área táctil de 44 pt; `label` es lo que anuncia el lector de pantalla. */
export function IconButton({ icon, label, onPress, tone = 'secondary', size = 22, disabled }: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: IconTone;
  size?: number;
  disabled?: boolean;
}) {
  const c = useTheme();
  const color = {
    default: c.text,
    secondary: c.textSecondary,
    primary: c.primary,
    danger: c.danger,
    onBrand: c.onBrand,
  }[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.button, (pressed || disabled) && styles.dim]}>
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minWidth: MinTouch, minHeight: MinTouch, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.5 },
});
