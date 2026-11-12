import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useIsOnline } from '@/shared/hooks/use-is-online';
import { Spacing } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';
import { IconBadge } from '@/shared/ui/display';
import { AppText, Button, type IconName } from '@/shared/ui/primitives';

// Estados obligatorios de cada pantalla (docs/01-producto/pantallas.md).
export function LoadingState() {
  const { t } = useTranslation();
  const c = useTheme();
  const online = useIsOnline();
  const queryClient = useQueryClient();
  // US-150: sin red las consultas quedan en pausa; en vez de un spinner eterno se dice qué pasa y se ofrece reintentar.
  // Al volver la conexión todo se carga solo.
  if (!online) {
    return (
      <View style={styles.center} accessibilityLiveRegion="polite">
        <IconBadge name="cloud-offline-outline" tone="warning" size={56} />
        <AppText secondary style={styles.text}>{t('common.waitingConnection')}</AppText>
        <Button
          label={t('common.retry')}
          variant="secondary"
          size="sm"
          icon="refresh"
          onPress={() => void queryClient.refetchQueries({ type: 'active' })}
        />
      </View>
    );
  }
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
