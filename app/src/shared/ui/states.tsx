import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Spacing } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';
import { IconBadge } from '@/shared/ui/display';
import { AppText, Button, type IconName } from '@/shared/ui/primitives';

// Estados obligatorios de cada pantalla (docs/01-producto/pantallas.md).
export function LoadingState() {
  const { t } = useTranslation();
  const c = useTheme();
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <ActivityIndicator color={c.primary} accessibilityLabel={t('common.loading')} />
    </View>
  );
}

/** Vacío con ícono, mensaje y, si aplica, la acción que lo resuelve. */
export function EmptyState({ message, action, icon = 'leaf-outline' }: { message: string; action?: ReactNode; icon?: IconName }) {
  return (
    <View style={styles.center}>
      <IconBadge name={icon} tone="primary" size={56} />
      <AppText secondary style={styles.text}>{message}</AppText>
      {action}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.center} accessibilityLiveRegion="assertive">
      <IconBadge name="cloud-offline-outline" tone="danger" size={56} />
      <AppText tone="danger" style={styles.text}>{message}</AppText>
      {onRetry && <Button label={t('common.retry')} variant="secondary" size="sm" icon="refresh" onPress={onRetry} />}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.lg },
  text: { textAlign: 'center' },
});
