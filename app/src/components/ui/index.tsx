import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type TextProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { MinTouch, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant = 'title' | 'subtitle' | 'body' | 'caption';

export function AppText({ variant = 'body', secondary, style, ...rest }: TextProps & { variant?: Variant; secondary?: boolean }) {
  const c = useTheme();
  return (
    <Text
      accessibilityRole={variant === 'title' ? 'header' : undefined}
      style={[styles[variant], { color: secondary ? c.textSecondary : c.text }, style]}
      {...rest}
    />
  );
}

export function Screen({ children }: { children: ReactNode }) {
  const c = useTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.background }]} edges={['top', 'left', 'right']}>
      {children}
    </SafeAreaView>
  );
}

export function Button({ label, onPress, variant = 'primary', disabled, hint }: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  hint?: string;
}) {
  const c = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: primary ? c.primary : 'transparent',
          borderColor: c.primary,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}>
      <Text style={[styles.buttonLabel, { color: primary ? c.onPrimary : c.primary }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, accessibilityLabel }: { children: ReactNode; accessibilityLabel?: string }) {
  const c = useTheme();
  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      {children}
    </View>
  );
}

// ---- Estados obligatorios de cada pantalla (01-producto/pantallas.md) ----
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
      <AppText secondary style={styles.centerText}>{message}</AppText>
      {action}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  const c = useTheme();
  return (
    <View style={styles.center} accessibilityLiveRegion="assertive">
      <AppText style={[styles.centerText, { color: c.danger }]}>{message}</AppText>
      {onRetry && <Button label={t('common.retry')} variant="secondary" onPress={onRetry} />}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  subtitle: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24 },
  caption: { fontSize: 14, lineHeight: 20 },
  screen: { flex: 1, paddingHorizontal: Spacing.md, paddingTop: Spacing.md, gap: Spacing.md },
  button: {
    minHeight: MinTouch,
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  card: { borderRadius: 12, borderWidth: 1, padding: Spacing.md, gap: Spacing.xs },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.lg },
  centerText: { textAlign: 'center' },
});
