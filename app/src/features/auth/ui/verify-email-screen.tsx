import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useResendConfirmation } from '@/features/auth/application/use-auth';
import { AppText, Banner, Button, Screen, TextLink } from '@/shared/ui';

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
    <Screen scroll>
      <AppText variant="title">{t('auth.verify.title')}</AppText>
      <AppText>{t('auth.verify.body', { email })}</AppText>
      <AppText secondary>{t('auth.verify.spam')}</AppText>

      {resend.isSuccess && <Banner tone="success" message={t('auth.verify.resent')} />}
      {resend.error && <Banner tone="danger" message={t(errorKey(resend.error))} />}

      <Button
        label={cooldown > 0 ? t('auth.verify.resendIn', { seconds: cooldown }) : t('auth.verify.resend')}
        variant="secondary"
        disabled={cooldown > 0 || !email}
        loading={resend.isPending}
        onPress={onResend}
      />
      <TextLink label={t('auth.verify.toSignIn')} onPress={() => router.replace({ pathname: '/sign-in', params: { email } })} />
    </Screen>
  );
}
