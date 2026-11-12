import { useRouter } from 'expo-router';
import { Alert, StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useExportMyData } from '@/features/account/application/account-queries';
import {
  useGrantSensitiveAuthorization,
  useProfile,
  useRevokeSensitiveAuthorization,
  useSensitiveAuthorization,
  useUpdateProfile,
} from '@/features/profile/application/profile-queries';
import { Spacing } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';
import { AppText, Banner, Button, FormSection, ListGroup, ListRow, LoadingState, Pill } from '@/shared/ui';

/** Autorización de datos sensibles: se puede dar y revocar en cualquier momento (ADR-011). */
export function PrivacySection({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const status = useSensitiveAuthorization();
  const grant = useGrantSensitiveAuthorization();
  const revoke = useRevokeSensitiveAuthorization();
  const router = useRouter();
  const exportData = useExportMyData(t('account.exportTitle'));
  const profile = useProfile();
  const update = useUpdateProfile();
  const c = useTheme();

  if (status.isPending) return <LoadingState />;

  // R4: revocar borra las alergias, así que los planes dejan de filtrarlas. Se pide confirmación explícita.
  const confirmRevoke = () =>
    Alert.alert(t('profile.privacy.revokeTitle'), t('profile.privacy.revokeWarning'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.privacy.revokeConfirm'), style: 'destructive', onPress: () => revoke.mutate(undefined, { onSuccess: onDone }) },
    ]);

  const error = grant.error ?? revoke.error ?? exportData.error ?? update.error;
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

      {/* US-131: estadísticas anónimas (sin cuenta, sin salud); se pueden apagar aquí en cualquier momento. */}
      <FormSection icon="stats-chart-outline" tone="neutral" title={t('profile.analytics.title')} hint={t('profile.analytics.hint')}>
        <View style={styles.switchRow}>
          <AppText style={styles.flex}>{t('profile.analytics.label')}</AppText>
          <Switch
            accessibilityLabel={t('profile.analytics.label')}
            value={profile.data?.analyticsEnabled ?? true}
            disabled={!profile.data || update.isPending}
            onValueChange={(value) => update.mutate({ analyticsEnabled: value })}
            trackColor={{ true: c.primary, false: c.border }}
          />
        </View>
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

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 44 },
  flex: { flex: 1 },
});
