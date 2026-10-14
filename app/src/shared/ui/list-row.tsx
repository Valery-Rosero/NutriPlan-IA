import Ionicons from '@expo/vector-icons/Ionicons';
import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MinTouch, Spacing } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';
import { Divider, IconBadge, type Tone } from '@/shared/ui/display';
import { AppText, Card, type IconName } from '@/shared/ui/primitives';

/**
 * Fila de ajustes: ícono, título, resumen y flecha. Toda la fila es un botón de ≥ 44 pt
 * y el lector anuncia "título: resumen". `danger` para acciones que sacan de la cuenta.
 */
export function ListRow({ icon, title, subtitle, onPress, tone = 'primary', danger, external }: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
  tone?: Tone;
  danger?: boolean;
  /** Abre un documento en lugar de una pantalla de edición. */
  external?: boolean;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}: ${subtitle}` : title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.surface }]}>
      <IconBadge name={icon} tone={danger ? 'danger' : tone} size={36} />
      <View style={styles.text}>
        <AppText variant="subtitle" tone={danger ? 'danger' : 'default'}>{title}</AppText>
        {subtitle && <AppText variant="caption" secondary numberOfLines={2}>{subtitle}</AppText>}
      </View>
      {!danger && <Ionicons name={external ? 'open-outline' : 'chevron-forward'} size={20} color={c.textSecondary} />}
    </Pressable>
  );
}

/** Agrupa filas en una tarjeta con separadores, bajo un título de grupo opcional. */
export function ListGroup({ title, children }: { title?: string; children: ReactNode }) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      {title && <AppText variant="label" secondary style={styles.groupTitle}>{title.toUpperCase()}</AppText>}
      <Card style={styles.card}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 && <View style={styles.inset}><Divider /></View>}
            {row}
          </Fragment>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: MinTouch + 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  text: { flex: 1, gap: Spacing.xxs },
  group: { gap: Spacing.xs },
  groupTitle: { marginLeft: Spacing.xs, letterSpacing: 0.8 },
  card: { padding: 0, gap: 0, overflow: 'hidden' },
  inset: { marginLeft: Spacing.md + 36 + Spacing.md },
});
