import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useLinkCode } from '@/features/auth/ui/use-link-code';
import { AppText, Banner, Button, LoadingState, Screen } from '@/shared/ui';

/**
 * Destino del enlace de confirmación de correo. Al canjear el código se abre la sesión: esta pantalla vive en el
 * grupo "sin sesión" del navegador raíz, que la deja apenas las puertas de arranque deciden (app, onboarding o
 * consentimientos). Antes se navegaba a "/" al instante y, con las puertas aún cargando, se quedaba aquí.
 */
export function AuthCallbackScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const link = useLinkCode();

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
