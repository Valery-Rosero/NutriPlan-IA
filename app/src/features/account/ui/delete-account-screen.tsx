import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useDeleteAccount, useExportMyData } from '@/features/account/application/account-queries';
import { canDelete, DELETE_CONFIRMATION } from '@/features/account/domain/account';
import { AppText, Banner, Button, Screen, TextField } from '@/shared/ui';

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
        <AppText variant="title">{t('account.deleteTitle')}</AppText>
        <AppText>{t('account.deleteWhat')}</AppText>
        <AppText secondary>{t('account.deleteRecipes')}</AppText>
        <Button label={t('account.exportFirst')} variant="secondary" loading={exportData.isPending} onPress={() => exportData.mutate()} />
        <TextField
          label={t('account.typeToConfirm', { word: DELETE_CONFIRMATION })}
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        {remove.error && <Banner tone="danger" message={t(errorKey(remove.error))} />}
        <Button
          label={t('account.deleteButton')}
          disabled={!canDelete(typed)}
          loading={remove.isPending}
          onPress={() => remove.mutate(typed)}
        />
      </Screen>
    </>
  );
}
