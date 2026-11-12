import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import {
  useEnablePush,
  useNotificationPreferences,
  usePushGranted,
  useSaveNotificationPreferences,
} from '@/features/notifications/application/use-notifications';
import { LEAD_OPTIONS, type NotificationPreferences } from '@/features/notifications/domain/notifications';
import { MinTouch, Spacing } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';
import {
  AppText,
  Banner,
  Button,
  Chip,
  ChipGroup,
  ErrorState,
  FormSection,
  LoadingState,
  Pill,
  SegmentedControl,
} from '@/shared/ui';

/**
 * US-148/149/153 · Perfil › Notificaciones. El permiso se pide aquí, en contexto (al tocar "Activar avisos"),
 * nunca al abrir la app. La frecuencia aplica desde la próxima notificación programada.
 */
export function NotificationsForm({ submitLabel, onSaved }: { submitLabel: string; onSaved: () => void }) {
  const { t } = useTranslation();
  const c = useTheme();
  const prefs = useNotificationPreferences();
  const granted = usePushGranted();
  const enable = useEnablePush();
  const save = useSaveNotificationPreferences();
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);

  if (prefs.isPending) return <LoadingState />;
  if (prefs.isError) return <ErrorState message={t(errorKey(prefs.error))} onRetry={() => void prefs.refetch()} />;

  const value = draft ?? prefs.data;
  const set = (patch: Partial<NotificationPreferences>) => setDraft({ ...value, ...patch });
  const result = enable.data;
  const active = granted.data === true || result?.status === 'granted';

  return (
    <>
      <FormSection icon="notifications-outline" title={t('notifications.deviceTitle')} hint={t('notifications.deviceHint')}>
        {active ? (
          <Pill label={t('notifications.active')} tone="primary" icon="checkmark-circle-outline" />
        ) : (
          <Button label={t('notifications.enable')} icon="notifications-outline" loading={enable.isPending} onPress={() => enable.mutate()} />
        )}
        {result?.status === 'denied' && <Banner tone="warning" message={t('notifications.denied')} />}
        {result?.status === 'unavailable' && <Banner tone="info" message={t('notifications.unavailable')} />}
        {enable.error && <Banner tone="danger" message={t(errorKey(enable.error))} />}
      </FormSection>

      <FormSection icon="calendar-outline" title={t('notifications.frequencyTitle')} hint={t(`notifications.frequencyHint.${value.frequency}`)}>
        <SegmentedControl
          label={t('notifications.frequencyTitle')}
          value={value.frequency}
          onChange={(frequency) => set({ frequency })}
          options={[
            { value: 'daily', label: t('notifications.daily') },
            { value: 'weekly_summary', label: t('notifications.weekly') },
            { value: 'none', label: t('notifications.none') },
          ]}
        />
      </FormSection>

      {value.frequency === 'daily' && (
        <FormSection icon="time-outline" title={t('notifications.leadTitle')} hint={t('notifications.leadHint', { minutes: value.leadMinutes })}>
          <ChipGroup>
            {LEAD_OPTIONS.map((m) => (
              <Chip key={m} label={t('notifications.leadOption', { minutes: m })} selected={value.leadMinutes === m} onPress={() => set({ leadMinutes: m })} />
            ))}
          </ChipGroup>
        </FormSection>
      )}

      {value.frequency !== 'none' && (
        <FormSection icon="alert-circle-outline" tone="warning" title={t('notifications.expiryTitle')} hint={t('notifications.expiryHint')}>
          <View style={styles.switchRow}>
            <AppText style={styles.flex}>{t('notifications.expiryLabel')}</AppText>
            <Switch
              accessibilityLabel={t('notifications.expiryLabel')}
              value={value.expiryAlerts}
              onValueChange={(expiryAlerts) => set({ expiryAlerts })}
              trackColor={{ true: c.primary, false: c.border }}
            />
          </View>
        </FormSection>
      )}

      <AppText variant="caption" secondary>{t('notifications.privacy')}</AppText>
      {save.error && <Banner tone="danger" message={t(errorKey(save.error))} />}
      <Button label={submitLabel} loading={save.isPending} onPress={() => save.mutate(value, { onSuccess: onSaved })} />
    </>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: MinTouch },
  flex: { flex: 1 },
});
