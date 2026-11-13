import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { foodEmoji } from '@/core/food-emoji';
import { formatCOP } from '@/core/format';
import { useApplySuggestion, useSendToAssistant } from '@/features/assistant/application/use-assistant';
import { quickReplies, type AssistantSuggestion, type ChatMessage, type WeekProposal } from '@/features/assistant/domain/assistant';
import { momentOfDay } from '@/features/cooking/domain/cooking';
import { WEEK_GOALS } from '@/features/plan/domain/plan';
import { MinTouch, Spacing } from '@/shared/theme/colors';
import { Radius, Typography } from '@/shared/theme/tokens';
import { useTheme } from '@/shared/theme/use-theme';
import {
  AppText,
  Banner,
  BrandHeader,
  Button,
  Card,
  Chip,
  ChipGroup,
  FoodTile,
  IconBadge,
  IconButton,
  MarkdownText,
  Pill,
} from '@/shared/ui';

/** Ancho de cada tarjeta de opción: se ve la siguiente asomándose, para que se entienda que hay más. */
const CARD_WIDTH = 264;

/**
 * Asistente (US-157, US-160, US-173, ADR-029). Conversa sobre qué cocinar y responde con formato (negritas,
 * listas). Propone hasta tres opciones en tarjetas deslizables: del recetario o recetas que crea con lo que
 * hay en la cocina. Cada tarjeta abre la receta y, si se abrió para cambiar una comida, la aplica.
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
              suggestions: reply.suggestions,
              fallback: reply.fallback,
              week: reply.week,
              hasPlan: reply.hasPlan,
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
                  <View
                    accessibilityLiveRegion="polite"
                    style={[styles.bubble, styles.theirs, { backgroundColor: c.card, borderColor: c.divider }]}>
                    {/* Responde con formato: **negritas** y listas (Markdown sencillo). */}
                    <MarkdownText source={m.text} />
                    {m.fallback && <AppText variant="caption" secondary>{t('assistant.fallback')}</AppText>}
                  </View>
                  {m.suggestions.length > 0 && <SuggestionList messageId={m.messageId} suggestions={m.suggestions} />}
                  {m.week && m.week.changes > 0 && <WeekCard week={m.week} />}
                  {/* S-7: sin IA no se entiende la frase; si tiene plan, las metas de la semana quedan a un toque. */}
                  {m.fallback && m.hasPlan && <WeekGoalChips />}
                </View>
              ),
            )}

            {send.isPending && (
              <View style={[styles.bubble, styles.theirs, styles.row, { backgroundColor: c.card, borderColor: c.divider }]}>
                <ActivityIndicator color={c.berry} />
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

/** US-174: el asistente entendió que quiere cambiar la semana. Las cifras vienen de la base. */
function WeekCard({ week }: { week: WeekProposal }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Card style={styles.week}>
      <View style={styles.row}>
        <IconBadge name="calendar-outline" tone="mango" />
        <View style={styles.flex}>
          <AppText variant="subtitle">{t('assistant.weekTitle')}</AppText>
          <View style={styles.pills}>
            <Pill label={t('assistant.weekChanges', { count: week.changes })} tone="mango" icon="swap-horizontal" />
            {week.saving !== null && week.saving > 0 && (
              <Pill label={t('assistant.weekSaving', { amount: formatCOP(week.saving) })} tone="accent" icon="trending-down-outline" />
            )}
          </View>
        </View>
      </View>
      <Button
        label={t('assistant.seeChanges')}
        icon="eye-outline"
        flavor="berry"
        size="sm"
        onPress={() =>
          router.push({
            pathname: '/plan/changes',
            params: {
              ...(week.goal ? { goal: week.goal } : {}),
              ...(week.avoid.length
                ? { avoid: week.avoid.map((a) => a.id).join(','), avoidNames: week.avoid.map((a) => a.name).join(',') }
                : {}),
            },
          })
        }
      />
    </Card>
  );
}

function WeekGoalChips() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <View style={styles.theirsWrap}>
      <AppText variant="caption" secondary>{t('assistant.weekFallback')}</AppText>
      <ChipGroup>
        {WEEK_GOALS.map((g) => (
          <Chip key={g} label={t(`plan.week.goals.${g}`)} selected={false} onPress={() => router.push({ pathname: '/plan/changes', params: { goal: g } })} />
        ))}
      </ChipGroup>
    </View>
  );
}

/** Las opciones de un mensaje, deslizables. Aplicar una (si hay comida que cambiar) cierra las demás. */
function SuggestionList({ messageId, suggestions }: { messageId: number; suggestions: AssistantSuggestion[] }) {
  const { t } = useTranslation();
  const apply = useApplySuggestion();
  const appliedId = apply.isSuccess ? apply.variables?.recipeId : undefined;
  return (
    <View style={styles.suggestions}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityLabel={t('assistant.optionsLabel')}
        contentContainerStyle={styles.cards}>
        {suggestions.map((s) => (
          <SuggestionCard
            key={s.recipeId}
            suggestion={s}
            applied={appliedId === s.recipeId}
            canApply={!!s.targetPlannedMealId && !apply.isSuccess}
            applying={apply.isPending && apply.variables?.recipeId === s.recipeId}
            onApply={() => apply.mutate({ messageId, recipeId: s.recipeId })}
          />
        ))}
      </ScrollView>
      {apply.isSuccess && <Banner tone="success" message={t('assistant.applied')} />}
      {apply.error && <Banner tone="danger" message={t(errorKey(apply.error))} />}
    </View>
  );
}

function SuggestionCard({ suggestion, applied, canApply, applying, onApply }: {
  suggestion: AssistantSuggestion;
  applied: boolean;
  canApply: boolean;
  applying: boolean;
  onApply: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  const router = useRouter();
  const s = suggestion;
  return (
    <Card style={[styles.card, { borderColor: applied ? c.berry : c.divider }]}>
      <FoodTile emoji={foodEmoji(s.title)} flavor={s.byAssistant ? 'berry' : 'tomato'} size={88} wide />
      <View style={styles.pills}>
        {s.byAssistant ? (
          <Pill label={t('assistant.byAssistant')} tone="berry" icon="sparkles-outline" />
        ) : (
          <Pill label={t('assistant.fromCatalog')} icon="book-outline" />
        )}
      </View>
      <AppText variant="subtitle">{s.title}</AppText>
      <View style={styles.pills}>
        <Pill label={t('cook.minutes', { count: s.totalMinutes })} icon="time-outline" />
        {s.missing.length === 0 ? (
          <Pill label={t('assistant.haveAll')} tone="accent" icon="checkmark" />
        ) : (
          <Pill label={t('cook.coverage', { percent: Math.round(s.coverage * 100) })} tone="accent" icon="basket-outline" />
        )}
      </View>
      {s.missing.length > 0 && <Pill label={t('assistant.toBuy', { list: s.missing.join(', ') })} tone="mango" icon="cart-outline" />}
      {s.byAssistant && <AppText variant="caption" secondary>{t('assistant.reviewAi')}</AppText>}
      <View style={styles.actions}>
        {canApply && (
          <Button label={t('assistant.apply')} icon="swap-horizontal" size="sm" flavor="berry" loading={applying} onPress={onApply} />
        )}
        <Button
          label={t('assistant.seeRecipe')}
          variant="outline"
          flavor="berry"
          size="sm"
          onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: s.recipeId } })}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  bubble: { maxWidth: '88%', padding: Spacing.md, borderRadius: Radius.lg, gap: Spacing.xs },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: Radius.sm },
  theirsWrap: { gap: Spacing.sm },
  theirs: { alignSelf: 'flex-start', borderWidth: 1, borderBottomLeftRadius: Radius.sm },
  suggestions: { gap: Spacing.sm, marginHorizontal: -Spacing.md },
  cards: { gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingBottom: Spacing.xs },
  card: { width: CARD_WIDTH, borderWidth: 1 },
  week: { alignSelf: 'stretch' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actions: { gap: Spacing.sm, marginTop: 'auto' },
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
