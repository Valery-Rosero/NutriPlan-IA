import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useExportMyData } from '@/features/account/application/account-queries';
import {
  useGrantSensitiveAuthorization,
  useRevokeSensitiveAuthorization,
  useSensitiveAuthorization,
} from '@/features/profile/application/profile-queries';
import { AppText, Banner, Button, LoadingState, TextLink } from '@/shared/ui';

/** Autorización de datos sensibles: se puede dar y revocar en cualquier momento (ADR-011). */
export function PrivacySection({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const status = useSensitiveAuthorization();
  const grant = useGrantSensitiveAuthorization();
  const revoke = useRevokeSensitiveAuthorization();
  const router = useRouter();
  const exportData = useExportMyData(t('account.exportTitle'));

  if (status.isPending) return <LoadingState />;

  // R4: revocar borra las alergias, así que los planes dejan de filtrarlas. Se pide confirmación explícita.
  const confirmRevoke = () =>
    Alert.alert(t('profile.privacy.revokeTitle'), t('profile.privacy.revokeWarning'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.privacy.revokeConfirm'), style: 'destructive', onPress: () => revoke.mutate(undefined, { onSuccess: onDone }) },
    ]);

  const error = grant.error ?? revoke.error ?? exportData.error;
  return (
    <>
      <AppText variant="subtitle">{t('profile.sensitive.title')}</AppText>
      <AppText>{status.data ? t('profile.privacy.granted') : t('profile.privacy.notGranted')}</AppText>
      {error && <Banner tone="danger" message={t(errorKey(error))} />}
      {status.data ? (
        <Button label={t('profile.privacy.revoke')} variant="secondary" loading={revoke.isPending} onPress={confirmRevoke} />
      ) : (
        <Button label={t('profile.sensitive.accept')} loading={grant.isPending} onPress={() => grant.mutate(undefined, { onSuccess: onDone })} />
      )}

      <AppText variant="subtitle">{t('account.rightsTitle')}</AppText>
      <AppText secondary>{t('account.rightsBody')}</AppText>
      <Button label={t('account.export')} variant="secondary" loading={exportData.isPending} onPress={() => exportData.mutate()} />
      <TextLink label={t('account.deleteTitle')} onPress={() => router.push('/account/delete')} />
    </>
  );
}
