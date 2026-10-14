import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { legalHref } from '@/features/legal/ui/legal-href';
import { useGrantSensitiveAuthorization, useSensitiveAuthorization } from '@/features/profile/application/profile-queries';
import { AppText, Banner, Button, FormSection, LoadingState, TextLink } from '@/shared/ui';

/** Autorización expresa, separada y facultativa para alergias, dietas y salud (ADR-011, Ley 1581 art. 6). */
export function SensitiveStep({ onDecided }: { onDecided: (authorized: boolean) => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const status = useSensitiveAuthorization();
  const grant = useGrantSensitiveAuthorization();

  if (status.isPending) return <LoadingState />;

  if (status.data) {
    return (
      <>
        <Banner tone="success" message={t('profile.sensitive.already')} />
        <Button label={t('common.continue')} onPress={() => onDecided(true)} />
      </>
    );
  }

  return (
    <>
      <FormSection icon="shield-checkmark-outline" title={t('profile.sensitive.title')}>
        <AppText>{t('profile.sensitive.why')}</AppText>
        <AppText variant="caption" secondary>{t('profile.sensitive.optional')}</AppText>
        <TextLink
          label={t('profile.sensitive.read')}
          icon="document-text-outline"
          onPress={() => router.push(legalHref('sensitive_data_authorization'))}
        />
      </FormSection>
      {grant.error && <Banner tone="danger" message={t(errorKey(grant.error))} />}
      {/* Autorizar es facultativo (Ley 1581): "Ahora no" queda igual de a la mano que aceptar. */}
      <Button
        label={t('profile.sensitive.accept')}
        icon="shield-checkmark-outline"
        loading={grant.isPending}
        onPress={() => grant.mutate(undefined, { onSuccess: () => onDecided(true) })}
      />
      <Button label={t('profile.sensitive.decline')} variant="secondary" onPress={() => onDecided(false)} />
    </>
  );
}
