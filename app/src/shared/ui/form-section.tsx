import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/shared/theme/colors';
import { IconBadge, type Tone } from '@/shared/ui/display';
import { AppText, Card, type IconName } from '@/shared/ui/primitives';

/** Bloque de formulario: ícono, pregunta y ayuda arriba; los controles debajo. Agrupa una sola decisión. */
export function FormSection({ icon, title, hint, tone = 'primary', children }: {
  icon: IconName;
  title: string;
  hint?: string;
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <Card>
      <View style={styles.head}>
        <IconBadge name={icon} tone={tone} />
        <View style={styles.flex}>
          <AppText variant="subtitle">{title}</AppText>
          {hint && <AppText variant="caption" secondary>{hint}</AppText>}
        </View>
      </View>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1, gap: Spacing.xxs },
});
