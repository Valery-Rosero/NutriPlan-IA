import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useResendConfirmation } from '@/features/auth/application/use-auth';
import { AuthScaffold } from '@/features/auth/ui/auth-scaffold';
import { Spacing } from '@/shared/theme/colors';
import { AppText, Banner, Button, Card, IconBadge } from '@/shared/ui';

const RESEND_COOLDOWN_S = 60;

export function VerifyEmailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const resend = useResendConfirmation();
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const onResend = () => resend.mutate(email, { onSuccess: () => setCooldown(RESEND_COOLDOWN_S) });

  return (
    <AuthScaffold icon="mail-unread-outline" title={t('auth.verify.title')} subtitle={t('auth.verify.lead')}>
      {/* El correo resaltado: así la persona detecta un error de escritura sin buscarlo en una frase. */}
      <Card variant="outlined" style={styles.email}>
        <IconBadge name="at" />
        <AppText variant="subtitle" style={styles.flex} selectable>{email}</AppText>
      </Card>
      <View style={styles.steps}>
        <AppText>{t('auth.verify.open')}</AppText>
        <AppText secondary>{t('auth.verify.spam')}</AppText>
      </View>

      {resend.isSuccess && <Banner tone="success" message={t('auth.verify.resent')} />}
      {resend.error && <Banner tone="danger" message={t(errorKey(resend.error))} />}

      <Button label={t('auth.verify.toSignIn')} onPress={() => router.replace({ pathname: '/sign-in', params: { email } })} />
      <Button
        label={cooldown > 0 ? t('auth.verify.resendIn', { seconds: cooldown }) : t('auth.verify.resend')}
        variant="secondary"
        icon="refresh"
        disabled={cooldown > 0 || !email}
        loading={resend.isPending}
        onPress={onResend}
      />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  email: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  steps: { gap: Spacing.sm },
});
