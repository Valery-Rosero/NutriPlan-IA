import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { MinTouch, Spacing } from '@/shared/theme/colors';
import { Radius } from '@/shared/theme/tokens';
import { useTheme } from '@/shared/theme/use-theme';
import { AppText, Screen, type IconName } from '@/shared/ui';

/**
 * Marco común de las pantallas de acceso ("Cocina viva"): encabezado claro con volver si hay historial,
 * el ícono en tomate suave, el título y la rayita de tomate. Así todo el acceso se ve como una sola pieza.
 */
export function AuthScaffold({ icon, title, subtitle, children }: {
  icon: IconName;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useTheme();
  const canGoBack = router.canGoBack();

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <View style={styles.topRow}>
          {canGoBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              hitSlop={8}
              onPress={() => router.back()}
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
              <Ionicons name="arrow-back" size={24} color={c.text} />
            </Pressable>
          ) : (
            <View />
          )}
          <View
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={[styles.icon, { backgroundColor: c.tomatoContainer }]}>
            <Ionicons name={icon} size={24} color={c.onTomatoContainer} />
          </View>
        </View>
        <AppText variant="title" accessibilityRole="header">{title}</AppText>
        <View style={[styles.accent, { backgroundColor: c.tomato }]} importantForAccessibility="no" accessibilityElementsHidden />
        {typeof subtitle === 'string' ? <AppText secondary>{subtitle}</AppText> : subtitle}
      </View>
      {children}
    </Screen>
  );
}

/** Separador con texto en medio («¿Aún no tienes cuenta?»). */
export function AuthDivider({ label }: { label: string }) {
  const c = useTheme();
  return (
    <View style={styles.divider}>
      <View style={[styles.line, { backgroundColor: c.divider }]} />
      <AppText variant="caption" secondary>{label}</AppText>
      <View style={[styles.line, { backgroundColor: c.divider }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: Spacing.sm, paddingTop: Spacing.xs, marginBottom: Spacing.sm },
  accent: { width: 44, height: 4, borderRadius: 2 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  back: { minWidth: MinTouch, minHeight: MinTouch, justifyContent: 'center', marginLeft: -Spacing.sm, paddingLeft: Spacing.sm },
  pressed: { opacity: 0.6 },
  icon: { width: 48, height: 48, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
});
