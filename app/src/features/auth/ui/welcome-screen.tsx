import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useCurrentDocuments } from '@/features/legal/application/legal-queries';
import { Spacing } from '@/shared/theme/colors';
import { Radius } from '@/shared/theme/tokens';
import { useTheme } from '@/shared/theme/use-theme';
import { AppText, Banner, Button, Screen } from '@/shared/ui';

const CHEF = require('../../../../assets/images/chef-bienvenida.jpg');

/** Bienvenida "Cocina viva": el chef de NutriPlan saluda, la promesa en una frase y las dos puertas. */
export function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useTheme();
  // Precarga los documentos vigentes que exige el registro y confirma que hay conexión.
  const legal = useCurrentDocuments();

  return (
    <Screen scroll>
      <Image
        source={CHEF}
        accessibilityLabel={t('auth.welcome.chefAlt')}
        contentFit="cover"
        style={[styles.chef, { backgroundColor: c.tomatoContainer }]}
      />

      <View style={styles.copy}>
        <AppText variant="label" style={[styles.eyebrow, { color: c.primary }]}>{t('common.appName').toUpperCase()}</AppText>
        <AppText variant="display" accessibilityRole="header">{t('auth.welcome.title')}</AppText>
        <AppText secondary>{t('auth.welcome.subtitle')}</AppText>
      </View>

      <View style={styles.actions}>
        {legal.isError && <Banner tone="danger" message={t('auth.welcome.notConnected')} />}
        <Button label={t('auth.welcome.createAccount')} onPress={() => router.push('/sign-up')} />
        <Button label={t('auth.welcome.signIn')} variant="outline" onPress={() => router.push('/sign-in')} />
        <AppText variant="caption" secondary style={styles.center}>{t('health.disclaimer')}</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chef: { width: '100%', aspectRatio: 1, borderRadius: Radius.xl, marginTop: Spacing.sm },
  copy: { gap: Spacing.sm },
  eyebrow: { letterSpacing: 1 },
  actions: { gap: Spacing.sm, marginTop: 'auto' },
  center: { textAlign: 'center' },
});
