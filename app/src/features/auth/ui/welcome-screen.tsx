import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useCurrentDocuments } from '@/features/legal/application/legal-queries';
import { Spacing } from '@/shared/theme/colors';
import { AppText, Banner, Button, Card, IconBadge, Screen, type IconName } from '@/shared/ui';

/** Las tres promesas del producto, en el orden en que la persona las vive. */
const BENEFITS: { key: string; icon: IconName }[] = [
  { key: 'cook', icon: 'restaurant-outline' },
  { key: 'week', icon: 'calendar-outline' },
  { key: 'list', icon: 'cart-outline' },
];

export function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  // Precarga los documentos vigentes que exige el registro y confirma que hay conexión.
  const legal = useCurrentDocuments();

  return (
    <Screen scroll>
      <Card variant="brand" style={styles.brand}>
        <AppText variant="label" tone="onBrandMuted">{t('common.appName').toUpperCase()}</AppText>
        <AppText variant="display" tone="onBrand">{t('auth.welcome.title')}</AppText>
        <AppText tone="onBrandMuted">{t('auth.welcome.subtitle')}</AppText>
      </Card>

      <View style={styles.benefits}>
        {BENEFITS.map((benefit) => (
          <View key={benefit.key} style={styles.benefit} accessible>
            <IconBadge name={benefit.icon} tone="accent" size={44} />
            <View style={styles.flex}>
              <AppText variant="subtitle">{t(`auth.welcome.benefits.${benefit.key}.title`)}</AppText>
              <AppText variant="caption" secondary>{t(`auth.welcome.benefits.${benefit.key}.body`)}</AppText>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        {legal.isError && <Banner tone="danger" message={t('auth.welcome.notConnected')} />}
        <Button label={t('auth.welcome.createAccount')} onPress={() => router.push('/sign-up')} />
        <Button label={t('auth.welcome.signIn')} variant="secondary" onPress={() => router.push('/sign-in')} />
        <AppText variant="caption" secondary style={styles.center}>{t('health.disclaimer')}</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { padding: Spacing.lg, gap: Spacing.md, marginTop: Spacing.lg },
  benefits: { gap: Spacing.md, paddingVertical: Spacing.sm },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  actions: { gap: Spacing.sm, marginTop: 'auto' },
  center: { textAlign: 'center' },
});
