import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useDeleteAccount, useExportMyData } from '@/features/account/application/account-queries';
import { canDelete, DELETE_CONFIRMATION } from '@/features/account/domain/account';
import { Spacing } from '@/shared/theme/colors';
import { AppText, Banner, Button, Card, IconBadge, Screen, TextField } from '@/shared/ui';

/** US-133: eliminar la cuenta con confirmación reforzada; antes se ofrece descargar los datos. */
export function DeleteAccountScreen() {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const exportData = useExportMyData(t('account.exportTitle'));
  const remove = useDeleteAccount();

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('account.deleteTitle') }} />
      <Screen scroll>
        <Card variant="outlined">
          <View style={styles.row}>
            <IconBadge name="warning-outline" tone="danger" size={48} />
            <AppText variant="heading" style={styles.flex}>{t('account.deleteHeadline')}</AppText>
          </View>
          <AppText>{t('account.deleteWhat')}</AppText>
          <AppText variant="caption" secondary>{t('account.deleteRecipes')}</AppText>
        </Card>

        {/* Antes de borrar, la salida más útil: llevarse los datos. */}
        <Button
          label={t('account.exportFirst')}
          icon="download-outline"
          variant="secondary"
          loading={exportData.isPending}
          onPress={() => exportData.mutate()}
        />
        {exportData.error && <Banner tone="danger" message={t(errorKey(exportData.error))} />}

        <TextField
          label={t('account.typeToConfirm', { word: DELETE_CONFIRMATION })}
          icon="create-outline"
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        {remove.error && <Banner tone="danger" message={t(errorKey(remove.error))} />}
        <Button
          label={t('account.deleteButton')}
          variant="danger"
          icon="trash-outline"
          disabled={!canDelete(typed)}
          loading={remove.isPending}
          onPress={() => remove.mutate(typed)}
        />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
});
