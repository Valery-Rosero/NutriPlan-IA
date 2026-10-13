import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useLinkCode } from '@/features/auth/ui/use-link-code';
import { AppText, Banner, Button, LoadingState, Screen } from '@/shared/ui';

/** Destino del enlace de confirmación de correo. Con sesión activa, el navegador raíz decide adónde ir. */
export function AuthCallbackScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const link = useLinkCode();

  useEffect(() => {
    if (link.success) router.replace('/');
  }, [link.success, router]);

  if (!link.failed) {
    return (
      <Screen>
        <AppText variant="subtitle">{t('auth.callback.verifying')}</AppText>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <Banner tone="warning" message={t('auth.callback.expired')} />
      <Button label={t('auth.callback.toSignIn')} onPress={() => router.replace('/sign-in')} />
    </Screen>
  );
}
