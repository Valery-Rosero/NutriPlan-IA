import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/shared/theme/colors';
import { IconButton } from '@/shared/ui/icon-button';
import { AppText, Card, type IconName } from '@/shared/ui/primitives';

/**
 * Encabezado de pestaña en el bloque de marca (Space Cadet + serif Tan): la misma pieza abre
 * Hoy, Mi cocina y Mi semana, para que las tres se lean como una sola app.
 */
export function BrandHeader({ eyebrow, caption, title, subtitle, action, children }: {
  eyebrow?: string;
  caption?: string;
  title: string;
  subtitle?: string;
  action?: { icon: IconName; label: string; onPress: () => void };
  children?: ReactNode;
}) {
  return (
    <Card variant="brand" style={styles.hero}>
      <View style={styles.top}>
        <View style={styles.flex}>
          {eyebrow && <AppText variant="label" tone="onBrandMuted">{eyebrow}</AppText>}
          {caption && <AppText variant="caption" tone="onBrandMuted">{caption}</AppText>}
        </View>
        {action && <IconButton icon={action.icon} label={action.label} onPress={action.onPress} tone="onBrand" size={30} />}
      </View>
      <AppText variant="title" tone="onBrand">{title}</AppText>
      {subtitle && <AppText tone="onBrandMuted">{subtitle}</AppText>}
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { padding: Spacing.lg, gap: Spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
});
