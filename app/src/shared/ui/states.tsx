import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Spacing } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';
import { AppText, Button } from '@/shared/ui/primitives';

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

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <View style={styles.center}>
      <AppText secondary style={styles.text}>{message}</AppText>
      {action}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  const c = useTheme();
  return (
    <View style={styles.center} accessibilityLiveRegion="assertive">
      <AppText style={[styles.text, { color: c.danger }]}>{message}</AppText>
      {onRetry && <Button label={t('common.retry')} variant="secondary" onPress={onRetry} />}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.lg },
  text: { textAlign: 'center' },
});
