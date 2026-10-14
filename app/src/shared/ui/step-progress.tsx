import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/shared/theme/colors';
import { Radius } from '@/shared/theme/tokens';
import { useTheme } from '@/shared/theme/use-theme';

/** Avance por pasos (onboarding): un segmento por paso, sobre el bloque de marca. El lector anuncia `label`. */
export function StepProgress({ step, total, label }: { step: number; total: number; label: string }) {
  const c = useTheme();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 1, max: total, now: step, text: label }}
      style={styles.row}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.segment, { backgroundColor: i < step ? c.onBrand : c.onBrandMuted, opacity: i < step ? 1 : 0.35 }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.xs },
  segment: { flex: 1, height: 6, borderRadius: Radius.pill },
});
