import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { foodEmoji } from '@/core/food-emoji';
import { formatCOP } from '@/core/format';
import { useApplySuggestion, useFillIdea, useSendToAssistant } from '@/features/assistant/application/use-assistant';
import {
  quickReplies,
  tidyChatMarkdown,
  type AssistantIdea,
  type AssistantSuggestion,
  type ChatMessage,
  type WeekProposal,
} from '@/features/assistant/domain/assistant';
import { momentOfDay } from '@/features/cooking/domain/cooking';
import { WEEK_GOALS } from '@/features/plan/domain/plan';
import { useRecipe, useRecipeCost, useRecipePreview } from '@/features/recipes/application/recipe-queries';
import { initialChoices } from '@/features/recipes/domain/recipe';
import { AddMissingToList } from '@/features/recipes/ui/add-missing-to-list';
import { formatQuantity } from '@/features/recipes/ui/format-quantity';
import { MinTouch, Spacing } from '@/shared/theme/colors';
import { Radius, Typography } from '@/shared/theme/tokens';
import { useTheme } from '@/shared/theme/use-theme';
import { dictationAvailable, joinDictation, useDictation } from '@/shared/voice/use-dictation';
import {
  AppText,
  Banner,
  BrandHeader,
  Button,
  Card,
  Chip,
  ChipGroup,
  DictateButton,
  DictationHint,
  DictationStatus,
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
  // Entrega 2: dictar junto a enviar. Lo dictado se suma a lo escrito y se revisa antes de enviar.
  const beforeDictation = useRef('');
  const dictation = useDictation((text) => setDraft(joinDictation(beforeDictation.current, text)));
  const startDictation = () => {
    beforeDictation.current = draft;
    void dictation.start();
  };
  const canDictate = dictationAvailable();

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
              conversationId: reply.conversationId,
              ideas: reply.ideas,
              targetPlannedMealId: reply.targetPlannedMealId,
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
            {/* Encabezado de una fila; la bienvenida solo mientras no hay conversación (luego, todo es chat). */}
            <BrandHeader compact title={t('assistant.title')} flavor="berry" />
            {messages.length === 0 && (
              <Card variant="filled">
                <View style={styles.row}>
                  <IconBadge name="sparkles-outline" tone="berry" />
                  <View style={styles.flex}>
                    <AppText variant="subtitle">
                      {mealTitle ? t('assistant.introSwap', { title: mealTitle }) : t('assistant.intro')}
                    </AppText>
                    <AppText variant="caption" secondary>{t('assistant.safety')}</AppText>
                    {!canDictate && <DictationHint />}
                  </View>
                </View>
              </Card>
            )}

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
                    <MarkdownText source={tidyChatMarkdown(m.text)} />
                    {m.fallback && <AppText variant="caption" secondary>{t('assistant.fallback')}</AppText>}
                  </View>
                  {m.ideas.length > 0 && <IdeaList conversationId={m.conversationId} messageId={m.messageId} ideas={m.ideas} />}
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

          <DictationStatus listening={dictation.listening} error={dictation.error} />
          <View style={[styles.composer, { borderColor: c.divider, backgroundColor: c.background }]}>
            <TextInput
              accessibilityLabel={t('assistant.inputLabel')}
              placeholder={dictation.listening ? t('voice.listeningShort') : t('assistant.placeholder')}
              placeholderTextColor={c.textSecondary}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => ask(draft)}
              maxLength={1000}
              returnKeyType="send"
              style={[styles.input, Typography.body, { color: c.text, backgroundColor: c.surface, borderColor: c.border }]}
            />
            {canDictate && (
              <DictateButton
                listening={dictation.listening}
                onStart={startDictation}
                onStop={dictation.stop}
                disabled={send.isPending}
              />
            )}
            <IconButton
              icon="send"
              tone="berry"
              label={t('assistant.send')}
              disabled={!draft.trim() || send.isPending || dictation.listening}
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

/**
 * ADR-037 · IA primero: la lista de platos (nombre, una frase y minutos). Al tocar uno, la IA llena la receta y la
 * base la valida; la receta aparece debajo, completa. Se puede elegir otro.
 */
function IdeaList({ conversationId, messageId, ideas }: { conversationId: string; messageId: number; ideas: AssistantIdea[] }) {
  const { t } = useTranslation();
  const c = useTheme();
  const fill = useFillIdea();
  const [chosen, setChosen] = useState<number | null>(null);
  const [recipes, setRecipes] = useState<Record<number, AssistantSuggestion>>({});
  const pick = (index: number) => {
    setChosen(index);
    if (recipes[index] || fill.isPending) return;
    fill.mutate(
      { conversationId, messageId, idea: index },
      { onSuccess: (s) => setRecipes((prev) => ({ ...prev, [index]: s })) },
    );
  };
  return (
    <View style={styles.ideas} accessibilityLabel={t('assistant.ideas.label')}>
      {ideas.map((idea, i) => {
        const selected = chosen === i;
        const busy = selected && fill.isPending;
        return (
          <View key={`${messageId}-${i}`} style={styles.ideaWrap}>
            <Pressable
              accessibilityLabel={`${idea.title}. ${idea.blurb} ${t('cook.minutes', { count: idea.minutes })}.`}
              accessibilityRole="button"
              accessibilityHint={t('assistant.ideas.pickHint')}
              accessibilityState={{ selected, busy }}
              onPress={() => pick(i)}
              style={[styles.idea, { borderColor: selected ? c.berry : c.divider, backgroundColor: c.card }]}>
              <FoodTile emoji={foodEmoji(idea.title)} flavor="berry" size={44} />
              <View style={styles.flex}>
                <AppText variant="subtitle">{idea.title}</AppText>
                {idea.blurb ? <AppText secondary>{idea.blurb}</AppText> : null}
                <View style={styles.pills}>
                  <Pill label={t('cook.minutes', { count: idea.minutes })} icon="time-outline" />
                  {idea.fromCatalog && <Pill label={t('assistant.fromCatalog')} icon="book-outline" />}
                </View>
              </View>
            </Pressable>
            {busy && (
              <View style={styles.row} accessibilityLiveRegion="polite">
                <ActivityIndicator color={c.berry} />
                <AppText secondary>{t('assistant.ideas.filling')}</AppText>
              </View>
            )}
            {selected && fill.error && !busy && <Banner tone="danger" message={t(errorKey(fill.error))} />}
            {recipes[i] && selected && <IdeaRecipe messageId={messageId} suggestion={recipes[i]} />}
          </View>
        );
      })}
    </View>
  );
}

/**
 * La receta que llenó la IA, completa y a la vista: porciones, minutos, nutrición y costo (de la base),
 * ingredientes con lo que hay y lo que falta, y los pasos. Desde aquí: cambiar la comida, llevar lo que falta a la
 * lista o abrir la receta para cocinarla.
 */
function IdeaRecipe({ messageId, suggestion }: { messageId: number; suggestion: AssistantSuggestion }) {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useTheme();
  const recipe = useRecipe(suggestion.recipeId);
  const servings = recipe.data?.baseServings ?? 0;
  const preview = useRecipePreview(suggestion.recipeId, servings, recipe.data ? initialChoices(recipe.data.groups) : null);
  const cost = useRecipeCost(suggestion.recipeId, servings, !!recipe.data);
  const apply = useApplySuggestion();
  if (!recipe.data || !preview.data) {
    return recipe.isError || preview.isError ? (
      <Banner tone="danger" message={t(errorKey(recipe.error ?? preview.error))} />
    ) : (
      <ActivityIndicator color={c.berry} />
    );
  }
  const r = recipe.data;
  const n = preview.data.per_serving;
  const missing = preview.data.lines.filter((l) => !l.in_pantry && !l.is_optional && l.grams > 0);
  return (
    <Card style={[styles.recipe, { borderColor: c.berry }]}>
      <View style={styles.pills}>
        <Pill label={suggestion.byAssistant ? t('assistant.byAssistant') : t('assistant.fromCatalog')} tone="berry" icon="sparkles-outline" />
      </View>
      <AppText variant="heading">{r.title}</AppText>
      <AppText secondary>{t('assistant.ideas.meta', { count: r.baseServings, minutes: r.totalMinutes })}</AppText>
      <View style={styles.pills}>
        {n && <Pill label={t('recipe.kcal', { value: Math.round(n.kcal) })} tone="accent" icon="flame-outline" />}
        {n && <Pill label={t('assistant.ideas.protein', { grams: Math.round(n.protein_g) })} tone="accent" icon="barbell-outline" />}
        {cost.data && <Pill label={t('assistant.ideas.cost', { amount: formatCOP(Math.round(cost.data.cost / 100) * 100) })} tone="mango" icon="cash-outline" />}
      </View>
      <AppText variant="label">{t('recipe.ingredients')}</AppText>
      {preview.data.lines.map((l) => (
        <AppText key={`${l.ingredient_id}-${l.group_key ?? 'b'}`}>
          {`• ${l.ingredient_name} · ${formatQuantity(l.quantity, l.unit_code, t)} — ${l.in_pantry ? t('recipe.atHome') : t('recipe.toBuy')}`}
        </AppText>
      ))}
      {r.extras.map((e) => (
        <AppText key={e.name}>{`• ${e.name} · ${Math.round(e.grams)} g — ${t('recipe.toBuy')}`}</AppText>
      ))}
      <AppText variant="label">{t('assistant.ideas.steps')}</AppText>
      {r.steps.map((step, i) => (
        <AppText key={i}>{`${i + 1}. ${step}`}</AppText>
      ))}
      <AppText variant="caption" secondary>{t('assistant.reviewAi')}</AppText>
      <View style={styles.actions}>
        {suggestion.targetPlannedMealId && !apply.isSuccess && (
          <Button
            label={t('assistant.apply')}
            icon="swap-horizontal"
            size="sm"
            flavor="berry"
            loading={apply.isPending}
            onPress={() => apply.mutate({ messageId, recipeId: suggestion.recipeId })}
          />
        )}
        <AddMissingToList items={missing.map((l) => ({ ingredientId: l.ingredient_id, grams: l.grams }))} extras={r.extras.map((e) => e.name)} />
        <Button
          label={t('assistant.ideas.open')}
          icon="restaurant-outline"
          variant="outline"
          flavor="berry"
          size="sm"
          onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: suggestion.recipeId } })}
        />
      </View>
      {apply.isSuccess && <Banner tone="success" message={t('assistant.applied')} />}
      {apply.error && <Banner tone="danger" message={t(errorKey(apply.error))} />}
    </Card>
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
  ideas: { gap: Spacing.sm },
  ideaWrap: { gap: Spacing.sm },
  idea: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderWidth: 1, borderRadius: Radius.lg },
  recipe: { borderWidth: 1, gap: Spacing.sm },
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
