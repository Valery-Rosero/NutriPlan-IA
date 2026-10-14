import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { HealthDisclaimerNote } from '@/features/legal/ui/health-disclaimer-note';
import { useProfile } from '@/features/profile/application/profile-queries';
import { useCookNow, useCookPlanned, useRecipe, useRecipePreview } from '@/features/recipes/application/recipe-queries';
import {
  initialChoices,
  slotForNow,
  toggleChoice,
  type Choice,
  type CookResult,
  type RecipeDetail,
  type RecipePreview,
} from '@/features/recipes/domain/recipe';
import { CookResultPanel } from '@/features/recipes/ui/cook-result';
import { formatQuantity } from '@/features/recipes/ui/format-quantity';
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
        <BrandHeader title={recipe.data.title} subtitle={recipe.data.description ?? undefined}>
          <View style={styles.pills}>
            <Pill label={t('recipe.meta', { minutes: recipe.data.totalMinutes })} icon="time-outline" />
            {recipe.data.keepsDays ? <Pill label={t('recipe.keeps', { count: recipe.data.keepsDays })} icon="snow-outline" /> : null}
          </View>
        </BrandHeader>

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
              <View style={[styles.stepNumber, { backgroundColor: c.brand }]}>
                <AppText variant="label" tone="onBrand">{String(i + 1)}</AppText>
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
            hint={t('recipe.cookNowHint')}
            loading={cook.isPending}
            onPress={onCook}
          />
        )}
        <HealthDisclaimerNote />
      </Screen>
    </>
  );
}

function FlexGroups({ detail, choices, onChange }: { detail: RecipeDetail; choices: Choice[]; onChange: (c: Choice[]) => void }) {
  const { t } = useTranslation();
  if (detail.groups.length === 0) return null;
  return (
    <Card variant="primary">
      <View style={styles.row}>
        <IconBadge name="swap-horizontal" tone="accent" />
        <View style={styles.flex}>
          <AppText variant="heading">{t('recipe.chooseTitle')}</AppText>
          <AppText variant="caption" secondary>{t('recipe.chooseHint')}</AppText>
        </View>
      </View>
      {detail.groups.map((group) => (
        <View key={group.key} style={styles.group}>
          <AppText variant="label">
            {`${group.label} · ${group.max > 1 ? t('recipe.chooseUpTo', { count: group.max }) : t('recipe.chooseOne')}`}
          </AppText>
          <ChipGroup>
            {group.options.map((o) => (
              <Chip
                key={o.ingredientId}
                multiple={group.max > 1}
                label={o.inPantry ? `${o.name} · ${t('recipe.atHome')}` : o.name}
                selected={choices.some((c) => c.groupKey === group.key && c.ingredientId === o.ingredientId)}
                onPress={() => onChange(toggleChoice(choices, group, o.ingredientId))}
              />
            ))}
          </ChipGroup>
        </View>
      ))}
    </Card>
  );
}

function PreviewSections({ preview }: { preview: RecipePreview }) {
  const { t } = useTranslation();
  const c = useTheme();
  const n = preview.per_serving;
  const have = preview.lines.filter((l) => l.in_pantry).length;
  const haveLabel = t('recipe.haveCount', { have, total: preview.lines.length });
  return (
    <>
      <SectionHeader title={t('recipe.ingredients')} />
      <Card>
        <ProgressBar value={preview.lines.length ? have / preview.lines.length : 0} label={haveLabel} />
        <AppText variant="caption" secondary>{haveLabel}</AppText>
        {preview.lines.map((line) => {
          const amount = formatQuantity(line.quantity, line.unit_code, t);
          const status = line.in_pantry ? t('recipe.atHome') : t('recipe.toBuy');
          return (
            <View
              key={`${line.ingredient_id}-${line.group_key ?? 'base'}`}
              style={styles.line}
              accessible
              accessibilityLabel={`${line.ingredient_name}, ${amount}. ${status}.`}>
              <Ionicons name={line.in_pantry ? 'checkmark-circle' : 'cart-outline'} size={20} color={line.in_pantry ? c.primary : c.textSecondary} />
              <View style={styles.flex}>
                <AppText>{`${line.ingredient_name}${line.is_optional ? ` (${t('recipe.optional')})` : ''}`}</AppText>
                <AppText variant="caption" style={{ color: line.in_pantry ? c.primary : c.textSecondary }}>{status}</AppText>
              </View>
              <AppText variant="label" secondary>{amount}</AppText>
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
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tile: { flexGrow: 1, flexBasis: '45%', padding: Spacing.md, borderRadius: Radius.md, gap: Spacing.xxs },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.xs },
  stepNumber: { width: 28, height: 28, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
});
