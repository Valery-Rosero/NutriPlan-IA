import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { foodEmoji } from '@/core/food-emoji';
import { HealthDisclaimerNote } from '@/features/legal/ui/health-disclaimer-note';
import { useCurrentPlan } from '@/features/plan/application/plan-queries';
import { useProfile } from '@/features/profile/application/profile-queries';
import { useCookNow, useCookPlanned, useRecipe, useRecipePreview, useSubstitutes } from '@/features/recipes/application/recipe-queries';
import {
  initialChoices,
  missingGroups,
  slotForNow,
  splitByPantry,
  substitutesByIngredient,
  toggleChoice,
  type Choice,
  type CookResult,
  type RecipeDetail,
  type RecipePreview,
  type Substitute,
} from '@/features/recipes/domain/recipe';
import { CookResultPanel } from '@/features/recipes/ui/cook-result';
import { formatQuantity } from '@/features/recipes/ui/format-quantity';
import { useAddMissingToList, useShoppingList } from '@/features/shopping/application/shopping-queries';
import { Spacing } from '@/shared/theme/colors';
import { Radius } from '@/shared/theme/tokens';
import { useTheme } from '@/shared/theme/use-theme';
import {
  AppText,
  Banner,
  BrandHeader,
  Button,
  Card,
  Chip,
  ChipGroup,
  ErrorState,
  FoodTile,
  IconBadge,
  LoadingState,
  Pill,
  ProgressBar,
  Screen,
  SectionHeader,
  Stepper,
} from '@/shared/ui';

/** US-118 (escalar), US-115 (nutrición por porción), ADR-020 (opciones con lo que hay), US-123 (cocinar). */
export function RecipeScreen() {
  const { t } = useTranslation();
  const c = useTheme();
  // mealId: se abrió desde el plan; cocinar marca ESA comida (con sus porciones).
  const { id, mealId, servings: plannedServings } = useLocalSearchParams<{ id: string; mealId?: string; servings?: string }>();
  const recipe = useRecipe(id);
  const profile = useProfile();
  const [servings, setServings] = useState<number | null>(null);
  const [choices, setChoices] = useState<Choice[] | null>(null);
  const [result, setResult] = useState<CookResult | null>(null);

  const detail = recipe.data;
  const currentServings =
    servings ?? (plannedServings ? Number(plannedServings) : null) ?? profile.data?.householdSize ?? detail?.baseServings ?? 4;
  const currentChoices = choices ?? (detail ? initialChoices(detail.groups) : null);
  const preview = useRecipePreview(id, currentServings, currentChoices);
  const cookNow = useCookNow(id);
  const cookPlanned = useCookPlanned();
  const cook = mealId ? cookPlanned : cookNow;

  if (recipe.isPending) return <Screen><LoadingState /></Screen>;
  if (recipe.isError) return <Screen><ErrorState message={t(errorKey(recipe.error))} onRetry={() => void recipe.refetch()} /></Screen>;

  // No se cocina con un grupo obligatorio vacío (la persona quitó su opción): primero hay que elegir.
  const incomplete = !!detail && !!currentChoices && missingGroups(detail.groups, currentChoices).length > 0;

  const onCook = () =>
    mealId
      ? cookPlanned.mutate({ plannedMealId: mealId, choices: currentChoices ?? [] }, { onSuccess: setResult })
      : cookNow.mutate(
          { slot: slotForNow(recipe.data.slots, new Date().getHours()), servings: currentServings, choices: currentChoices ?? [] },
          { onSuccess: setResult },
        );

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '' }} />
      <Screen scroll>
        <FoodTile emoji={foodEmoji(recipe.data.title)} size={140} wide />
        <BrandHeader title={recipe.data.title} subtitle={recipe.data.description ?? undefined}>
          <View style={styles.pills}>
            <Pill label={t('recipe.meta', { minutes: recipe.data.totalMinutes })} icon="time-outline" />
            {recipe.data.keepsDays ? <Pill label={t('recipe.keeps', { count: recipe.data.keepsDays })} icon="snow-outline" /> : null}
          </View>
        </BrandHeader>
        {/* ADR-029: lo que inventa el asistente se marca; la base ya la validó con tus alergias y tu dieta. */}
        {recipe.data.byAssistant && <Banner tone="info" message={t('recipe.byAssistant')} />}

        <Card variant="filled" style={styles.row}>
          <IconBadge name="people-outline" />
          <View style={styles.flex}>
            {mealId ? (
              <AppText>{t('recipe.plannedServings', { count: currentServings })}</AppText>
            ) : (
              <Stepper label={t('recipe.servings')} value={currentServings} min={1} max={12} onChange={setServings} />
            )}
          </View>
        </Card>

        <FlexGroups detail={recipe.data} choices={currentChoices ?? []} onChange={setChoices} />

        {preview.isError ? (
          <ErrorState message={t(errorKey(preview.error))} onRetry={() => void preview.refetch()} />
        ) : preview.data ? (
          <PreviewSections preview={preview.data} />
        ) : (
          <LoadingState />
        )}

        <SectionHeader title={t('recipe.steps')} />
        <Card>
          {recipe.data.steps.map((step, i) => (
            <View key={i} style={styles.step} accessible accessibilityLabel={t('recipe.stepA11y', { n: i + 1, text: step })}>
              <View style={[styles.stepNumber, { backgroundColor: c.tomato }]}>
                <AppText variant="label" style={{ color: c.onTomato }}>{String(i + 1)}</AppText>
              </View>
              <AppText style={styles.flex}>{step}</AppText>
            </View>
          ))}
        </Card>

        {cook.error && <Banner tone="danger" message={t(errorKey(cook.error))} />}
        {result ? (
          <CookResultPanel result={result} onUndone={() => setResult(null)} />
        ) : (
          <Button
            label={t(mealId ? 'recipe.cookPlanned' : 'recipe.cookNow')}
            icon="flame-outline"
            hint={incomplete ? t('recipe.completeChoicesFirst') : t('recipe.cookNowHint')}
            disabled={incomplete}
            loading={cook.isPending}
            onPress={onCook}
          />
        )}
        <HealthDisclaimerNote />
      </Screen>
    </>
  );
}

/** Subtítulo de las opciones: "En tu cocina" (albahaca) o "Para comprar" (mango); se entiende sin leer. */
function OptionsHeader({ kind, label }: { kind: 'have' | 'buy'; label: string }) {
  return (
    <View style={styles.optionsHeader}>
      <Pill label={label} tone={kind === 'have' ? 'accent' : 'mango'} icon={kind === 'have' ? 'home-outline' : 'cart-outline'} />
    </View>
  );
}

function FlexGroups({ detail, choices, onChange }: { detail: RecipeDetail; choices: Choice[]; onChange: (c: Choice[]) => void }) {
  const { t } = useTranslation();
  if (detail.groups.length === 0) return null;
  return (
    <Card>
      <View style={styles.row}>
        <IconBadge name="swap-horizontal" />
        <View style={styles.flex}>
          <AppText variant="heading">{t('recipe.chooseTitle')}</AppText>
          <AppText variant="caption" secondary>{t('recipe.chooseHint')}</AppText>
        </View>
      </View>
      {detail.groups.map((group) => {
        const { have, buy } = splitByPantry(group.options);
        const chip = (o: (typeof group.options)[number]) => (
          <Chip
            key={o.ingredientId}
            flavor={o.inPantry ? 'basil' : 'mango'}
            multiple={group.max > 1}
            removable
            label={o.name}
            selected={choices.some((c) => c.groupKey === group.key && c.ingredientId === o.ingredientId)}
            onPress={() => onChange(toggleChoice(choices, group, o.ingredientId))}
          />
        );
        const missing = choices.filter((c) => c.groupKey === group.key).length < group.min;
        return (
          <View key={group.key} style={styles.group}>
            <AppText variant="label">
              {`${group.label} · ${group.max > 1 ? t('recipe.chooseUpTo', { count: group.max }) : t('recipe.chooseOne')}`}
            </AppText>
            {have.length > 0 && (
              <>
                <OptionsHeader kind="have" label={t('recipe.options.have')} />
                <ChipGroup>{have.map(chip)}</ChipGroup>
              </>
            )}
            {buy.length > 0 && (
              <>
                <OptionsHeader kind="buy" label={t('recipe.options.buy')} />
                <ChipGroup>{buy.map(chip)}</ChipGroup>
              </>
            )}
            {missing && <Banner tone="warning" message={t('recipe.options.chooseAtLeast', { count: group.min, group: group.label })} />}
          </View>
        );
      })}
    </Card>
  );
}

function PreviewSections({ preview }: { preview: RecipePreview }) {
  const { t } = useTranslation();
  const n = preview.per_serving;
  const have = preview.lines.filter((l) => l.in_pantry).length;
  // US-147: para lo que falta, qué se puede usar en su lugar (seguro para la persona; lo filtra la base).
  const missingIds = preview.lines.filter((l) => !l.in_pantry).map((l) => l.ingredient_id);
  const substitutes = substitutesByIngredient(useSubstitutes(missingIds).data ?? []);
  const haveLabel = t('recipe.haveCount', { have, total: preview.lines.length });
  return (
    <>
      <SectionHeader title={t('recipe.ingredients')} />
      <Card>
        <ProgressBar value={preview.lines.length ? have / preview.lines.length : 0} label={haveLabel} tone="accent" />
        <AppText variant="caption" secondary>{haveLabel}</AppText>
        <AddMissingToList
          items={preview.lines
            .filter((l) => !l.in_pantry && !l.is_optional)
            .map((l) => `${l.ingredient_name} (${formatQuantity(l.quantity, l.unit_code, t)})`)}
        />
        {preview.lines.map((line) => {
          const amount = formatQuantity(line.quantity, line.unit_code, t);
          const status = line.in_pantry ? t('recipe.atHome') : t('recipe.toBuy');
          return (
            <View key={`${line.ingredient_id}-${line.group_key ?? 'base'}`}>
              <View style={styles.line} accessible accessibilityLabel={`${line.ingredient_name}, ${amount}. ${status}.`}>
              <FoodTile emoji={foodEmoji(line.ingredient_name, '🥫')} flavor={line.in_pantry ? 'basil' : 'mango'} size={40} />
              <View style={styles.flex}>
                <AppText>{`${line.ingredient_name}${line.is_optional ? ` (${t('recipe.optional')})` : ''}`}</AppText>
                <View style={styles.status}>
                  <Pill label={status} tone={line.in_pantry ? 'accent' : 'mango'} icon={line.in_pantry ? 'checkmark' : 'cart-outline'} />
                </View>
              </View>
              <AppText variant="label" secondary>{amount}</AppText>
              </View>
              {!line.in_pantry && substitutes.has(line.ingredient_id) && (
                <SubstituteHint options={substitutes.get(line.ingredient_id)!} />
              )}
            </View>
          );
        })}
      </Card>

      {preview.allergens.length > 0 && (
        <Banner tone="warning" message={t('recipe.contains', { list: preview.allergens.map((a) => t(`allergens.${a}`)).join(', ') })} />
      )}

      {n && (
        <>
          <SectionHeader title={t('recipe.nutrition')} />
          <Card>
            <View style={styles.tiles} accessible accessibilityLabel={t('recipe.nutritionA11y', { kcal: Math.round(n.kcal), protein: Math.round(n.protein_g) })}>
              <NutrientTile value={t('recipe.kcal', { value: Math.round(n.kcal) })} label={t('recipe.energy')} highlight />
              <NutrientTile value={`${Math.round(n.protein_g)} g`} label={t('recipe.protein')} />
              <NutrientTile value={`${Math.round(n.carbs_g)} g`} label={t('recipe.carbs')} />
              <NutrientTile value={`${Math.round(n.fat_g)} g`} label={t('recipe.fat')} />
            </View>
            <AppText variant="caption" secondary>
              {t('recipe.micros', { fiber: Math.round(n.fiber_g), sugar: Math.round(n.sugar_g), sodium: Math.round(n.sodium_mg) })}
            </AppText>
            <AppText variant="caption" secondary>{t('recipe.nutritionNote')}</AppText>
          </Card>
        </>
      )}
    </>
  );
}

/** Lo que falta para esta receta, a la lista de mercado de una vez (con su cantidad). */
function AddMissingToList({ items }: { items: string[] }) {
  const { t } = useTranslation();
  const plan = useCurrentPlan();
  const list = useShoppingList(plan.data?.id);
  const add = useAddMissingToList();
  if (items.length === 0) return null;
  if (add.isSuccess) return <Banner tone="success" message={t('recipe.addedMissing')} />;
  if (!list.data) {
    // Sin plan no hay lista todavía: se explica en vez de mostrar un botón que no puede funcionar.
    const loading = plan.isPending || (!!plan.data && list.isPending);
    return loading ? null : <AppText variant="caption" secondary>{t('recipe.noListYet')}</AppText>;
  }
  const current = list.data;
  return (
    <>
      <Button
        label={t('recipe.addMissing', { count: items.length })}
        icon="cart-outline"
        variant="secondary"
        flavor="mango"
        size="sm"
        loading={add.isPending}
        onPress={() => add.mutate({ list: current, items })}
      />
      {add.error && <Banner tone="danger" message={t(errorKey(add.error))} />}
    </>
  );
}

/** "Puedes usar: Papa (la tienes), Yuca". Lo que ya está en la cocina va primero y resaltado. */
function SubstituteHint({ options }: { options: Substitute[] }) {
  const { t } = useTranslation();
  const c = useTheme();
  const text = options.map((o) => (o.inPantry ? `${o.name} (${t('recipe.substitutes.have')})` : o.name)).join(', ');
  const note = options.find((o) => o.note)?.note;
  return (
    <View style={styles.substitute} accessible accessibilityLabel={`${t('recipe.substitutes.label')} ${text}. ${note ?? ''}`}>
      <Ionicons name="swap-horizontal" size={16} color={options[0].inPantry ? c.success : c.textSecondary} />
      <View style={styles.flex}>
        <AppText variant="caption" style={{ color: options[0].inPantry ? c.success : c.text }}>{`${t('recipe.substitutes.label')} ${text}`}</AppText>
        {note && <AppText variant="caption" secondary>{note}</AppText>}
      </View>
    </View>
  );
}

function NutrientTile({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) {
  const c = useTheme();
  const fg = highlight ? { color: c.onPrimaryContainer } : undefined;
  return (
    <View style={[styles.tile, { backgroundColor: highlight ? c.primaryContainer : c.surface }]}>
      <AppText variant="subtitle" style={fg}>{value}</AppText>
      <AppText variant="caption" secondary={!highlight} style={fg}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  group: { gap: Spacing.sm },
  optionsHeader: { flexDirection: 'row' },
  status: { flexDirection: 'row', marginTop: Spacing.xxs },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
  substitute: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs, marginLeft: 40 + Spacing.md, marginBottom: Spacing.xs },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tile: { flexGrow: 1, flexBasis: '45%', padding: Spacing.md, borderRadius: Radius.md, gap: Spacing.xxs },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.xs },
  // Mínimo 28 y crece con la letra del sistema: "10" cabe al 200 % (US-140).
  stepNumber: { minWidth: 28, minHeight: 28, paddingHorizontal: Spacing.xs, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
});
