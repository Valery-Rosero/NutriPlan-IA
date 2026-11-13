import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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

import { ButtonHeight, flavorColors, MinTouch, Spacing, type FlavorName, type ThemeColors } from '@/shared/theme/colors';
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
    // Edge-to-edge en Android (SDK 57): la ventana no se achica con el teclado; "padding" en ambas plataformas.
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
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
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

/**
 * Botón "Cocina viva": 52 pt de alto (44 en `sm`), esquinas de 16.
 * Tres niveles claros: `primary` lleno, `secondary` suave (fondo del sabor), `outline` con borde; `ghost` sin fondo.
 * `flavor` lo pinta con el sabor de su sección (p. ej. albahaca en Mi cocina); sin él, tomate.
 */
export function Button({ label, onPress, variant = 'primary', size = 'md', icon, disabled, loading, hint, flavor }: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  hint?: string;
  flavor?: FlavorName;
}) {
  const c = useTheme();
  const inactive = disabled || loading;
  const f = flavorColors(c, flavor ?? 'tomato');
  const palette = {
    primary: { bg: f.fill, fg: f.onFill, border: f.fill },
    secondary: { bg: f.container, fg: f.onContainer, border: f.container },
    outline: { bg: 'transparent', fg: flavor ? f.onContainer : c.primary, border: flavor ? f.onContainer : c.primary },
    ghost: { bg: 'transparent', fg: flavor ? f.onContainer : c.primary, border: 'transparent' },
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
          {icon && <Ionicons name={icon} size={size === 'sm' ? 18 : 22} color={palette.fg} />}
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
        <Text style={[Typography.label, styles.linkLabel, { color: c.primary }]}>{label}</Text>
        {icon && <Ionicons name={icon} size={16} color={c.primary} />}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------- Tarjetas
type CardVariant = 'elevated' | 'outlined' | 'filled' | 'primary' | 'brand';

/**
 * Contenedor de esquinas de 20. `elevated` (por defecto): blanco con sombra cálida, sin borde duro;
 * `outlined` con borde; `filled` agrupa sobre "avena"; `primary` destaca en tomate suave; `brand` = bloque tomate.
 */
export function Card({ children, accessibilityLabel, variant = 'elevated', style }: {
  children: ReactNode;
  accessibilityLabel?: string;
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const look: Record<CardVariant, ViewStyle> = {
    elevated: { backgroundColor: c.card, borderColor: 'transparent', ...elevation(1, c.shadow) },
    outlined: { backgroundColor: c.card, borderColor: c.divider },
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
    info: { bg: c.surface, fg: c.text, icon: 'information-circle' as IconName },
    success: { bg: c.successContainer, fg: c.onSuccessContainer, icon: 'checkmark-circle' as IconName },
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
    minHeight: ButtonHeight,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSm: { minHeight: MinTouch, paddingHorizontal: Spacing.md, alignSelf: 'flex-start' },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  buttonLabelMd: { fontSize: 17, fontWeight: '700' },
  pressed: { transform: [{ scale: 0.98 }] },
  link: { minHeight: MinTouch, justifyContent: 'center', alignSelf: 'flex-start' },
  linkLabel: { fontSize: 15, textDecorationLine: 'underline' },
  card: { borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, borderRadius: Radius.lg, padding: Spacing.md },
  bannerText: { flex: 1 },
});
