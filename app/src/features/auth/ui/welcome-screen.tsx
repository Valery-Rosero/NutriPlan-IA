import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useCurrentDocuments } from '@/features/legal/application/legal-queries';
import { Spacing } from '@/shared/theme/colors';
import { AppText, Banner, Button, Screen } from '@/shared/ui';

export function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  // Precarga los documentos vigentes que exige el registro y confirma que hay conexión.
  const legal = useCurrentDocuments();

  return (
    <Screen>
      <View style={styles.hero}>
        <AppText variant="title">{t('auth.welcome.title')}</AppText>
        <AppText secondary>{t('auth.welcome.subtitle')}</AppText>
      </View>
      <View style={styles.actions}>
        {legal.isError && <Banner tone="danger" message={t('auth.welcome.notConnected')} />}
        <Button label={t('auth.welcome.createAccount')} onPress={() => router.push('/sign-up')} />
        <Button label={t('auth.welcome.signIn')} variant="secondary" onPress={() => router.push('/sign-in')} />
        <AppText variant="caption" secondary>{t('health.disclaimer')}</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, justifyContent: 'center', gap: Spacing.md },
  actions: { gap: Spacing.sm, paddingBottom: Spacing.lg },
});
