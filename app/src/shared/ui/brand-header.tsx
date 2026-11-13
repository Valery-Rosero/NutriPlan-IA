import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { flavorColors, Spacing, type FlavorName } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';
import { IconButton } from '@/shared/ui/icon-button';
import { AppText, type IconName } from '@/shared/ui/primitives';

/**
 * Encabezado de sección "Cocina viva": claro, con un saludo arriba, el título grande y una rayita con el
 * sabor de la sección (Hoy tomate, Mi cocina albahaca, Mi semana mango, Asistente mora). Antes era un bloque
 * azul igual en todas las pantallas; ahora cada sección se reconoce por su color sin pintar todo el bloque.
 */
export function BrandHeader({ eyebrow, caption, title, subtitle, action, back, flavor = 'tomato', children }: {
  /** Texto corto en mayúsculas sobre el título (p. ej. el nombre de la app). */
  eyebrow?: string;
  /** Saludo o contexto ("Buenas tardes, Valery"). */
  caption?: string;
  title: string;
  subtitle?: string;
  action?: { icon: IconName; label: string; onPress: () => void };
  /** Volver dentro de un flujo (p. ej. el paso anterior del onboarding). */
  back?: { label: string; onPress: () => void };
  flavor?: FlavorName;
  children?: ReactNode;
}) {
  const c = useTheme();
  const f = flavorColors(c, flavor);
  return (
    <View style={styles.header}>
      {(back || eyebrow || caption || action) && (
        <View style={styles.top}>
          {back && (
            <View style={styles.back}>
              <IconButton icon="arrow-back" label={back.label} onPress={back.onPress} tone="default" size={24} />
            </View>
          )}
          <View style={styles.flex}>
            {eyebrow && <AppText variant="label" style={[styles.eyebrow, { color: f.onContainer }]}>{eyebrow}</AppText>}
            {caption && <AppText variant="caption" secondary>{caption}</AppText>}
          </View>
          {action && <IconButton icon={action.icon} label={action.label} onPress={action.onPress} tone="default" size={30} />}
        </View>
      )}
      <AppText variant="title" accessibilityRole="header">{title}</AppText>
      {/* El sabor de la sección, como un detalle (decorativo). */}
      <View style={[styles.accent, { backgroundColor: f.fill }]} importantForAccessibility="no" accessibilityElementsHidden />
      {subtitle && <AppText secondary>{subtitle}</AppText>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.sm, paddingTop: Spacing.xs, paddingBottom: Spacing.xs },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 44 },
  flex: { flex: 1 },
  back: { marginLeft: -Spacing.sm },
  eyebrow: { letterSpacing: 1, textTransform: 'uppercase' },
  accent: { width: 44, height: 4, borderRadius: 2 },
});
