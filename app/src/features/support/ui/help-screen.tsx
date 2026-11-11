import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useSendTicket } from '@/features/support/application/use-support';
import { MESSAGE_MAX, ticketSchema, type NewTicket, type TicketCategory } from '@/features/support/domain/support';
import { Spacing } from '@/shared/theme/colors';
import { Radius } from '@/shared/theme/tokens';
import { AppText, Banner, Button, EmptyState, FormSection, IconButton, Screen, SegmentedControl, TextField } from '@/shared/ui';

/**
 * US-151: Perfil › Ayuda. Problema o sugerencia (hasta 500 caracteres) con captura opcional.
 * Solo se adjuntan la versión de la app y el modelo del teléfono; nunca datos de salud ni de perfil.
 */
export function HelpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const send = useSendTicket();
  const [category, setCategory] = useState<TicketCategory>('bug');
  const [message, setMessage] = useState('');
  const [screenshot, setScreenshot] = useState<NewTicket['screenshot']>(null);
  const [touched, setTouched] = useState(false);

  const parsed = ticketSchema.safeParse({ category, message });
  const error = touched && !parsed.success ? parsed.error.issues[0]?.message : undefined;

  const pick = async () => {
    // Selector del sistema: en Android 13+ no pide permiso de galería completa.
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) setScreenshot({ uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' });
  };

  const submit = () => {
    setTouched(true);
    if (parsed.success) send.mutate({ ...parsed.data, screenshot });
  };

  if (send.isSuccess) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: t('support.title') }} />
        <Screen>
          <EmptyState
            icon="checkmark-circle-outline"
            message={t(category === 'bug' ? 'support.sentBug' : 'support.sentSuggestion')}
            action={<Button label={t('common.back')} onPress={() => router.back()} />}
          />
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('support.title') }} />
      <Screen scroll>
        <FormSection icon="chatbubbles-outline" title={t('support.heading')} hint={t('support.hint')}>
          <SegmentedControl
            label={t('support.categoryLabel')}
            value={category}
            onChange={setCategory}
            options={[
              { value: 'bug', label: t('support.bug') },
              { value: 'suggestion', label: t('support.suggestion') },
            ]}
          />
          <TextField
            label={t(category === 'bug' ? 'support.messageBug' : 'support.messageSuggestion')}
            value={message}
            onChangeText={(v) => setMessage(v.slice(0, MESSAGE_MAX))}
            onBlur={() => setTouched(true)}
            maxLength={MESSAGE_MAX}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            style={styles.message}
            error={error}
          />
          <AppText variant="caption" secondary style={styles.counter}>
            {t('support.counter', { count: message.length, max: MESSAGE_MAX })}
          </AppText>
        </FormSection>

        <FormSection icon="image-outline" title={t('support.screenshotTitle')} hint={t('support.screenshotHint')}>
          {screenshot ? (
            <View style={styles.preview}>
              <Image source={{ uri: screenshot.uri }} style={styles.thumb} accessibilityLabel={t('support.screenshotAttached')} />
              <AppText style={styles.flex}>{t('support.screenshotAttached')}</AppText>
              <IconButton icon="close" label={t('support.removeScreenshot')} onPress={() => setScreenshot(null)} />
            </View>
          ) : (
            <Button label={t('support.attach')} icon="attach-outline" variant="secondary" size="sm" onPress={() => void pick()} />
          )}
        </FormSection>

        <Banner tone="info" message={t('support.privacy')} />
        {send.error && <Banner tone="danger" message={t(errorKey(send.error))} />}
        <Button label={t('support.send')} icon="send-outline" loading={send.isPending} onPress={submit} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  message: { minHeight: 120, paddingTop: Spacing.sm },
  counter: { textAlign: 'right' },
  preview: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  thumb: { width: 56, height: 56, borderRadius: Radius.sm },
  flex: { flex: 1 },
});
