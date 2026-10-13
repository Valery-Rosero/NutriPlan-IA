import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useCurrentLegalDocuments } from '@/features/legal/api';
import { useTheme } from '@/hooks/use-theme';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const c = useTheme();
  // Además de traer los ids que exige el registro, confirma que la app llega al servidor.
  const legal = useCurrentLegalDocuments();

  return (
    <Screen>
      <View style={styles.hero}>
        <AppText variant="title">{t('auth.welcome.title')}</AppText>
        <AppText secondary>{t('auth.welcome.subtitle')}</AppText>
      </View>

      <View style={styles.actions}>
        <Button label={t('auth.welcome.createAccount')} disabled hint={t('common.comingSoon')} />
        <Button label={t('auth.welcome.signIn')} variant="secondary" disabled hint={t('common.comingSoon')} />
        {!legal.isPending && (
          <AppText
            variant="caption"
            style={{ color: legal.isSuccess ? c.textSecondary : c.danger }}
            accessibilityLiveRegion="polite">
            {legal.isSuccess ? t('auth.welcome.connected') : t('auth.welcome.notConnected')}
          </AppText>
        )}
        <AppText variant="caption" secondary>{t('health.disclaimer')}</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, justifyContent: 'center', gap: Spacing.md },
  actions: { gap: Spacing.sm, paddingBottom: Spacing.lg },
});
