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
import { useTheme } from '@/shared/theme/use-theme';
import { AppText, Banner, Button, Card, Chip, ChipGroup, ErrorState, LoadingState, Screen, Stepper } from '@/shared/ui';

/** US-118 (escalar), US-115 (nutrición por porción), ADR-020 (opciones con lo que hay), US-123 (cocinar). */
export function RecipeScreen() {
  const { t } = useTranslation();
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
        <AppText variant="title">{recipe.data.title}</AppText>
        {recipe.data.description && <AppText secondary>{recipe.data.description}</AppText>}
        <AppText variant="caption" secondary>
          {t('recipe.meta', { minutes: recipe.data.totalMinutes })}
          {recipe.data.keepsDays ? ` · ${t('recipe.keeps', { count: recipe.data.keepsDays })}` : ''}
        </AppText>

        {!mealId && <Stepper label={t('recipe.servings')} value={currentServings} min={1} max={12} onChange={setServings} />}
        {mealId && <AppText secondary>{t('recipe.plannedServings', { count: currentServings })}</AppText>}

        <FlexGroups detail={recipe.data} choices={currentChoices ?? []} onChange={setChoices} />

        {preview.isError ? (
          <ErrorState message={t(errorKey(preview.error))} onRetry={() => void preview.refetch()} />
        ) : preview.data ? (
          <PreviewSections preview={preview.data} />
        ) : (
          <LoadingState />
        )}

        <AppText variant="subtitle">{t('recipe.steps')}</AppText>
        {recipe.data.steps.map((step, i) => (
          <AppText key={i}>{`${i + 1}. ${step}`}</AppText>
        ))}

        {cook.error && <Banner tone="danger" message={t(errorKey(cook.error))} />}
        {result ? (
          <CookResultPanel result={result} onUndone={() => setResult(null)} />
        ) : (
          <Button label={t(mealId ? 'recipe.cookPlanned' : 'recipe.cookNow')} hint={t('recipe.cookNowHint')} loading={cook.isPending} onPress={onCook} />
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
    <>
      <AppText variant="subtitle">{t('recipe.chooseTitle')}</AppText>
      {detail.groups.map((group) => (
        <View key={group.key} style={styles.group}>
          <AppText>{group.label}</AppText>
          <AppText variant="caption" secondary>
            {group.max > 1 ? t('recipe.chooseUpTo', { count: group.max }) : t('recipe.chooseOne')}
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
    </>
  );
}

function PreviewSections({ preview }: { preview: RecipePreview }) {
  const { t } = useTranslation();
  const c = useTheme();
  const n = preview.per_serving;
  return (
    <>
      <AppText variant="subtitle">{t('recipe.ingredients')}</AppText>
      {preview.lines.map((line) => (
        <View key={`${line.ingredient_id}-${line.group_key ?? 'base'}`} style={styles.line}>
          <AppText style={styles.lineName}>
            {`${line.ingredient_name}${line.is_optional ? ` (${t('recipe.optional')})` : ''}`}
          </AppText>
          <AppText secondary>{formatQuantity(line.quantity, line.unit_code, t)}</AppText>
          <AppText variant="caption" style={{ color: line.in_pantry ? c.primary : c.textSecondary }}>
            {line.in_pantry ? t('recipe.atHome') : t('recipe.toBuy')}
          </AppText>
        </View>
      ))}

      {preview.allergens.length > 0 && (
        <Banner tone="warning" message={t('recipe.contains', { list: preview.allergens.map((a) => t(`allergens.${a}`)).join(', ') })} />
      )}

      {n && (
        <Card accessibilityLabel={t('recipe.nutritionA11y', { kcal: n.kcal, protein: n.protein_g })}>
          <AppText variant="subtitle">{t('recipe.nutrition')}</AppText>
          <AppText>{t('recipe.kcal', { value: Math.round(n.kcal) })}</AppText>
          <AppText secondary>
            {t('recipe.macros', { protein: Math.round(n.protein_g), carbs: Math.round(n.carbs_g), fat: Math.round(n.fat_g) })}
          </AppText>
          <AppText secondary>{t('recipe.micros', { fiber: Math.round(n.fiber_g), sugar: Math.round(n.sugar_g), sodium: Math.round(n.sodium_mg) })}</AppText>
          <AppText variant="caption" secondary>{t('recipe.nutritionNote')}</AppText>
        </Card>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  lineName: { flex: 1, minWidth: 140 },
});
