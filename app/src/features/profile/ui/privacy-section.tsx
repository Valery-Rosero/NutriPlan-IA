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
import { Banner, Button, FormSection, ListGroup, ListRow, LoadingState, Pill } from '@/shared/ui';

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
      <FormSection
        icon="shield-checkmark-outline"
        tone={status.data ? 'primary' : 'warning'}
        title={t('profile.sensitive.title')}
        hint={status.data ? t('profile.privacy.granted') : t('profile.privacy.notGranted')}>
        <Pill
          label={status.data ? t('profile.privacy.on') : t('profile.privacy.off')}
          tone={status.data ? 'primary' : 'warning'}
          icon={status.data ? 'checkmark-circle-outline' : 'alert-circle-outline'}
        />
        {status.data ? (
          <Button label={t('profile.privacy.revoke')} variant="secondary" size="sm" loading={revoke.isPending} onPress={confirmRevoke} />
        ) : (
          <Button
            label={t('profile.sensitive.accept')}
            icon="shield-checkmark-outline"
            loading={grant.isPending}
            onPress={() => grant.mutate(undefined, { onSuccess: onDone })}
          />
        )}
      </FormSection>

      {error && <Banner tone="danger" message={t(errorKey(error))} />}

      <ListGroup title={t('account.rightsTitle')}>
        <ListRow icon="download-outline" title={t('account.export')} subtitle={t('account.exportHint')} onPress={() => exportData.mutate()} />
        <ListRow icon="trash-outline" title={t('account.deleteTitle')} danger onPress={() => router.push('/account/delete')} />
      </ListGroup>
      {exportData.isPending && <LoadingState />}
    </>
  );
}
