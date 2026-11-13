import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useApplySuggestion, useSendToAssistant } from '@/features/assistant/application/use-assistant';
import { quickReplies, type AssistantSuggestion, type ChatMessage } from '@/features/assistant/domain/assistant';
import { momentOfDay } from '@/features/cooking/domain/cooking';
import { MinTouch, Spacing } from '@/shared/theme/colors';
import { Radius, Typography } from '@/shared/theme/tokens';
import { useTheme } from '@/shared/theme/use-theme';
import { AppText, Banner, BrandHeader, Button, Card, Chip, ChipGroup, IconBadge, IconButton, Pill } from '@/shared/ui';

/**
 * Asistente (US-157, US-160, US-173). Conversa sobre qué cocinar; cuando sugiere una receta, la muestra
 * como tarjeta con "Ver receta" y, si se abrió para cambiar una comida, "Aplicar" (sin salir del chat).
 */
export function AssistantScreen() {
  const { t } = useTranslation();
  const c = useTheme();
  const { mealId, mealTitle } = useLocalSearchParams<{ mealId?: string; mealTitle?: string }>();
  const send = useSendToAssistant();
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const scroll = useRef<ScrollView>(null);

  const ask = (text: string) => {
    const message = text.trim();
    if (!message || send.isPending) return;
    setDraft('');
    setMessages((prev) => [...prev, { id: `u${Date.now()}`, role: 'user', text: message }]);
    send.mutate(
      { conversationId, message, plannedMealId: mealId },
      {
        onSuccess: (reply) => {
          setConversationId(reply.conversationId);
          setMessages((prev) => [
            ...prev,
            {
              id: `a${reply.messageId}`,
              role: 'assistant',
              text: reply.reply,
              messageId: reply.messageId,
              suggestion: reply.suggestion,
              fallback: reply.fallback,
            },
          ]);
        },
      },
    );
  };

  const chips = quickReplies(!!mealId, momentOfDay(new Date().getHours()));

  return (
    <>
      {/* Pestaña propia (mora): la barra flotante va abajo, así que aquí solo se protege la parte de arriba. */}
      <SafeAreaView style={[styles.flex, { backgroundColor: c.background }]} edges={['top', 'left', 'right']}>
        {/* Android es edge-to-edge (SDK 57): la ventana ya no se achica con el teclado, así que hay que
            empujar el contenido en las dos plataformas o la caja de texto queda debajo del teclado. */}
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <ScrollView
            ref={scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
            <BrandHeader title={t('assistant.title')} caption={t('assistant.headerCaption')} flavor="berry" />
            <Card variant="filled">
              <View style={styles.row}>
                <IconBadge name="sparkles-outline" tone="berry" />
                <View style={styles.flex}>
                  <AppText variant="subtitle">
                    {mealTitle ? t('assistant.introSwap', { title: mealTitle }) : t('assistant.intro')}
                  </AppText>
                  <AppText variant="caption" secondary>{t('assistant.safety')}</AppText>
                </View>
              </View>
            </Card>

            {messages.map((m) =>
              m.role === 'user' ? (
                <View key={m.id} style={[styles.bubble, styles.mine, { backgroundColor: c.berry }]}>
                  <AppText style={{ color: c.onBerry }}>{m.text}</AppText>
                </View>
              ) : (
                <View key={m.id} style={styles.theirsWrap}>
                  <View style={[styles.bubble, styles.theirs, { backgroundColor: c.card, borderColor: c.divider }]}>
                    <AppText accessibilityLiveRegion="polite">{m.text}</AppText>
                    {m.fallback && <AppText variant="caption" secondary>{t('assistant.fallback')}</AppText>}
                  </View>
                  {m.suggestion && <SuggestionCard messageId={m.messageId} suggestion={m.suggestion} />}
                </View>
              ),
            )}

            {send.isPending && (
              <View style={[styles.bubble, styles.theirs, styles.row, { backgroundColor: c.card, borderColor: c.divider }]}>
                <ActivityIndicator color={c.primary} />
                <AppText secondary>{t('assistant.thinking')}</AppText>
              </View>
            )}
            {send.error && <Banner tone="danger" message={t(errorKey(send.error))} />}

            {messages.length === 0 && (
              <ChipGroup>
                {chips.map((key) => (
                  <Chip key={key} label={t(`assistant.${key}`)} selected={false} onPress={() => ask(t(`assistant.${key}`))} />
                ))}
              </ChipGroup>
            )}
          </ScrollView>

          <View style={[styles.composer, { borderColor: c.divider, backgroundColor: c.background }]}>
            <TextInput
              accessibilityLabel={t('assistant.inputLabel')}
              placeholder={t('assistant.placeholder')}
              placeholderTextColor={c.textSecondary}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => ask(draft)}
              maxLength={1000}
              returnKeyType="send"
              style={[styles.input, Typography.body, { color: c.text, backgroundColor: c.surface, borderColor: c.border }]}
            />
            <IconButton
              icon="send"
              tone="berry"
              label={t('assistant.send')}
              disabled={!draft.trim() || send.isPending}
              onPress={() => ask(draft)}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

function SuggestionCard({ messageId, suggestion }: { messageId: number; suggestion: AssistantSuggestion }) {
  const { t } = useTranslation();
  const c = useTheme();
  const router = useRouter();
  const apply = useApplySuggestion();
  return (
    <Card variant="primary" style={[styles.suggestion, { backgroundColor: c.berryContainer }]}>
      <AppText variant="subtitle">{suggestion.title}</AppText>
      <View style={styles.pills}>
        <Pill label={t('cook.minutes', { count: suggestion.totalMinutes })} icon="time-outline" />
        <Pill label={t('cook.coverage', { percent: Math.round(suggestion.coverage * 100) })} icon="basket-outline" />
      </View>
      {apply.isSuccess ? (
        <Banner tone="success" message={t('assistant.applied')} />
      ) : (
        <View style={styles.actions}>
          {suggestion.targetPlannedMealId && (
            <Button label={t('assistant.apply')} icon="swap-horizontal" size="sm" flavor="berry" loading={apply.isPending} onPress={() => apply.mutate(messageId)} />
          )}
          <Button
            label={t('assistant.seeRecipe')}
            variant="outline"
            flavor="berry"
            size="sm"
            onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: suggestion.recipeId } })}
          />
        </View>
      )}
      {apply.error && <Banner tone="danger" message={t(errorKey(apply.error))} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  bubble: { maxWidth: '85%', padding: Spacing.md, borderRadius: Radius.lg, gap: Spacing.xs },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: Radius.sm },
  theirsWrap: { gap: Spacing.sm },
  theirs: { alignSelf: 'flex-start', borderWidth: 1, borderBottomLeftRadius: Radius.sm },
  suggestion: { marginLeft: Spacing.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actions: { gap: Spacing.sm },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, minHeight: MinTouch, borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.md },
});
