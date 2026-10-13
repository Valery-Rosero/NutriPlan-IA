import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MinTouch, Spacing } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';

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

/** Pantalla base. `scroll` para formularios: se desplaza y respeta el teclado. */
export function Screen({ children, scroll }: { children: ReactNode; scroll?: boolean }) {
  const c = useTheme();
  const body = scroll ? (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  ) : (
    <View style={[styles.flex, styles.content]}>{children}</View>
  );
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.background }]} edges={['top', 'left', 'right', 'bottom']}>
      {body}
    </SafeAreaView>
  );
}

export function Button({ label, onPress, variant = 'primary', disabled, loading, hint }: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  hint?: string;
}) {
  const c = useTheme();
  const primary = variant === 'primary';
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: primary ? c.primary : 'transparent',
          borderColor: c.primary,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}>
      {loading ? (
        <ActivityIndicator color={primary ? c.onPrimary : c.primary} />
      ) : (
        <Text style={[styles.buttonLabel, { color: primary ? c.onPrimary : c.primary }]}>{label}</Text>
      )}
    </Pressable>
  );
}

/** Enlace de texto con área táctil de 44 pt. */
export function TextLink({ label, onPress, hint }: { label: string; onPress: () => void; hint?: string }) {
  const c = useTheme();
  return (
    <Pressable accessibilityRole="link" accessibilityHint={hint} onPress={onPress} hitSlop={8} style={styles.link}>
      <Text style={[styles.linkLabel, { color: c.accent }]}>{label}</Text>
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

/** Aviso destacado. El tono también va en el texto, no solo en el color (accesibilidad). */
export function Banner({ message, tone = 'info' }: { message: string; tone?: 'info' | 'warning' | 'danger' | 'success' }) {
  const c = useTheme();
  const color = tone === 'danger' ? c.danger : tone === 'warning' ? c.warning : tone === 'success' ? c.primary : c.accent;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.banner, { borderColor: color, backgroundColor: c.surface }]}>
      <Text style={[styles.body, { color }]}>{message}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, gap: Spacing.md },
  scrollContent: { flexGrow: 1, padding: Spacing.md, gap: Spacing.md },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  subtitle: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24 },
  caption: { fontSize: 14, lineHeight: 20 },
  button: {
    minHeight: MinTouch,
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  link: { minHeight: MinTouch, justifyContent: 'center', alignSelf: 'flex-start' },
  linkLabel: { fontSize: 16, fontWeight: '600', textDecorationLine: 'underline' },
  card: { borderRadius: 12, borderWidth: 1, padding: Spacing.md, gap: Spacing.xs },
  banner: { borderLeftWidth: 4, borderRadius: 8, padding: Spacing.md },
});
