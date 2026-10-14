import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MinTouch, Spacing, type ThemeColors } from '@/shared/theme/colors';
import { elevation, Radius, Typography, type TypographyVariant } from '@/shared/theme/tokens';
import { useTheme } from '@/shared/theme/use-theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------- Texto
type TextTone = 'default' | 'secondary' | 'primary' | 'danger' | 'warning' | 'onPrimary' | 'onBrand' | 'onBrandMuted';

const toneColor = (c: ThemeColors, tone: TextTone) =>
  ({
    default: c.text, secondary: c.textSecondary, primary: c.primary, danger: c.danger, warning: c.warning,
    onPrimary: c.onPrimary, onBrand: c.onBrand, onBrandMuted: c.onBrandMuted,
  })[tone];

/** Texto con la escala tipográfica. `secondary` se conserva por compatibilidad (= tone "secondary"). */
export function AppText({ variant = 'body', tone = 'default', secondary, style, ...rest }: TextProps & {
  variant?: TypographyVariant;
  tone?: TextTone;
  secondary?: boolean;
}) {
  const c = useTheme();
  const isHeader = variant === 'display' || variant === 'title' || variant === 'heading';
  return (
    <Text
      accessibilityRole={isHeader ? 'header' : undefined}
      style={[Typography[variant], { color: toneColor(c, secondary ? 'secondary' : tone) }, style]}
      {...rest}
    />
  );
}

// ---------------------------------------------------------------- Pantalla
/** Pantalla base. `scroll` para contenido largo y formularios; `onRefresh` activa deslizar para actualizar. */
export function Screen({ children, scroll, refreshing, onRefresh }: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const c = useTheme();
  const body = scroll ? (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />
          ) : undefined
        }>
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

// ---------------------------------------------------------------- Botones
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/** Botón de 48 pt (≥ 44 pt). `icon` opcional a la izquierda; `size="sm"` para acciones dentro de tarjetas. */
export function Button({ label, onPress, variant = 'primary', size = 'md', icon, disabled, loading, hint }: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  hint?: string;
}) {
  const c = useTheme();
  const inactive = disabled || loading;
  const palette = {
    primary: { bg: c.primary, fg: c.onPrimary, border: c.primary },
    secondary: { bg: 'transparent', fg: c.primary, border: c.primary },
    ghost: { bg: 'transparent', fg: c.primary, border: 'transparent' },
    danger: { bg: c.dangerContainer, fg: c.onDangerContainer, border: c.dangerContainer },
  }[variant];

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
        size === 'sm' && styles.buttonSm,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        pressed && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.buttonRow}>
          {icon && <Ionicons name={icon} size={size === 'sm' ? 18 : 20} color={palette.fg} />}
          <Text style={[Typography.label, size === 'md' && styles.buttonLabelMd, { color: palette.fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Enlace de texto con área táctil de 44 pt. */
export function TextLink({ label, onPress, hint, icon }: { label: string; onPress: () => void; hint?: string; icon?: IconName }) {
  const c = useTheme();
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} accessibilityHint={hint} onPress={onPress} hitSlop={8} style={styles.link}>
      <View style={styles.buttonRow}>
        <Text style={[Typography.label, styles.linkLabel, { color: c.accent }]}>{label}</Text>
        {icon && <Ionicons name={icon} size={16} color={c.accent} />}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------- Tarjetas
type CardVariant = 'elevated' | 'outlined' | 'filled' | 'primary' | 'brand';

/** Contenedor. `elevated` (por defecto); `filled` agrupa; `primary` destaca; `brand` = bloque Space Cadet con texto Tan. */
export function Card({ children, accessibilityLabel, variant = 'elevated', style }: {
  children: ReactNode;
  accessibilityLabel?: string;
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const look: Record<CardVariant, ViewStyle> = {
    elevated: { backgroundColor: c.card, borderColor: c.divider, ...elevation(1, c.shadow) },
    outlined: { backgroundColor: 'transparent', borderColor: c.border },
    filled: { backgroundColor: c.surface, borderColor: 'transparent' },
    primary: { backgroundColor: c.primaryContainer, borderColor: 'transparent' },
    brand: { backgroundColor: c.brand, borderColor: 'transparent', ...elevation(2, c.shadow) },
  };
  return (
    <View accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel} style={[styles.card, look[variant], style]}>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------- Avisos
type BannerTone = 'info' | 'warning' | 'danger' | 'success';

/** Aviso destacado con ícono. El tono también va en el ícono y el texto, no solo en el color (accesibilidad). */
export function Banner({ message, tone = 'info' }: { message: string; tone?: BannerTone }) {
  const c = useTheme();
  const look = {
    info: { bg: c.accentContainer, fg: c.onAccentContainer, icon: 'information-circle' as IconName },
    success: { bg: c.primaryContainer, fg: c.onPrimaryContainer, icon: 'checkmark-circle' as IconName },
    warning: { bg: c.warningContainer, fg: c.onWarningContainer, icon: 'alert-circle' as IconName },
    danger: { bg: c.dangerContainer, fg: c.onDangerContainer, icon: 'close-circle' as IconName },
  }[tone];
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.banner, { backgroundColor: look.bg }]}>
      <Ionicons name={look.icon} size={20} color={look.fg} />
      <Text style={[Typography.body, styles.bannerText, { color: look.fg }]}>{message}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, gap: Spacing.md },
  scrollContent: { flexGrow: 1, padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  button: {
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSm: { minHeight: MinTouch, paddingHorizontal: Spacing.md, alignSelf: 'flex-start' },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  buttonLabelMd: { fontSize: 16 },
  pressed: { transform: [{ scale: 0.98 }] },
  link: { minHeight: MinTouch, justifyContent: 'center', alignSelf: 'flex-start' },
  linkLabel: { fontSize: 15, textDecorationLine: 'underline' },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, borderRadius: Radius.md, padding: Spacing.md },
  bannerText: { flex: 1 },
});
