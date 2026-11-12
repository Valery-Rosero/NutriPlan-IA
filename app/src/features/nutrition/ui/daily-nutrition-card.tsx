import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { capitalize } from '@/core/format';
import { useDayNutrition } from '@/features/nutrition/application/use-nutrition';
import { summarizeDay } from '@/features/nutrition/domain/nutrition';
import { useProfile } from '@/features/profile/application/profile-queries';
import { Spacing } from '@/shared/theme/colors';
import { Radius } from '@/shared/theme/tokens';
import { useTheme } from '@/shared/theme/use-theme';
import { AppText, Card, IconBadge, Pill, ProgressBar } from '@/shared/ui';

/**
 * US-159 · Mi día: kcal y macros de lo YA cocinado hoy (por porción), frente a la meta si la hay.
 * Lo que falta se muestra como "pendiente" y no se cuenta como 0. Informativo, no una indicación médica.
 */
export function DailyNutritionCard({ date }: { date: string }) {
  const { t } = useTranslation();
  const c = useTheme();
  const meals = useDayNutrition(date);
  const profile = useProfile();

  if (!meals.data || meals.data.length === 0) return null; // sin comidas hoy no hay nada que resumir
  const target = profile.data?.dailyKcalTarget ?? null;
  const s = summarizeDay(meals.data, target);
  const proteinGoal = profile.data?.targetProteinPct ?? null;

  return (
    <Card>
      <View style={styles.row}>
        <IconBadge name="nutrition-outline" tone="accent" />
        <View style={styles.flex}>
          <AppText variant="caption" secondary>{t('nutrition.title')}</AppText>
          <AppText variant="subtitle">
            {target ? t('nutrition.kcalOfTarget', { kcal: s.kcal, target }) : t('nutrition.kcal', { kcal: s.kcal })}
          </AppText>
        </View>
      </View>
      {target !== null && (
        <ProgressBar value={s.kcal / target} label={t('nutrition.kcalOfTarget', { kcal: s.kcal, target })} />
      )}

      <View style={styles.tiles} accessible accessibilityLabel={t('nutrition.macrosA11y', { p: s.proteinG, c: s.carbsG, f: s.fatG })}>
        {[
          { label: t('recipe.protein'), value: s.proteinG },
          { label: t('recipe.carbs'), value: s.carbsG },
          { label: t('recipe.fat'), value: s.fatG },
        ].map((m) => (
          <View key={m.label} style={[styles.tile, { backgroundColor: c.surface }]}>
            <AppText variant="subtitle">{`${Math.round(m.value)} g`}</AppText>
            <AppText variant="caption" secondary>{m.label}</AppText>
          </View>
        ))}
      </View>

      {proteinGoal !== null && s.proteinPct !== null && (
        <AppText variant="caption" secondary>{t('nutrition.proteinShare', { pct: s.proteinPct, goal: proteinGoal })}</AppText>
      )}

      <AppText variant="caption" secondary>{t('nutrition.counted', { count: s.cookedCount })}</AppText>
      {s.pending.length > 0 && (
        <View style={styles.pills}>
          {s.pending.map((m) => (
            <Pill key={m.plannedMealId} label={t('nutrition.pending', { slot: capitalize(t(`slots.${m.slot}`)) })} icon="time-outline" />
          ))}
        </View>
      )}
      <AppText variant="caption" secondary>{t('nutrition.note')}</AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  tiles: { flexDirection: 'row', gap: Spacing.sm },
  tile: { flex: 1, padding: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', gap: Spacing.xxs },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
