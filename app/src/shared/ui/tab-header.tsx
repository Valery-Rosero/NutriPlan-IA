import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MinTouch, Spacing } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';
import { AppText } from '@/shared/ui/primitives';

/** Título de una pestaña con una acción a la derecha (p. ej. abrir el perfil). */
export function TabHeader({ title, subtitle, actionIcon, actionLabel, onAction }: {
  title: string;
  subtitle?: string;
  actionIcon?: ComponentProps<typeof Ionicons>['name'];
  actionLabel?: string;
  onAction?: () => void;
}) {
  const c = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.titles}>
        <AppText variant="title">{title}</AppText>
        {subtitle && <AppText secondary>{subtitle}</AppText>}
      </View>
      {actionIcon && onAction && (
        <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} style={styles.action} hitSlop={8}>
          <Ionicons name={actionIcon} size={30} color={c.primary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  titles: { flex: 1 },
  action: { minWidth: MinTouch, minHeight: MinTouch, alignItems: 'center', justifyContent: 'center' },
});
