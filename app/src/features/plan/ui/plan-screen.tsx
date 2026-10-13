import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { formatDay } from '@/core/format';
import { HealthDisclaimerNote } from '@/features/legal/ui/health-disclaimer-note';
import { todayIso } from '@/features/pantry/domain/pantry';
import { useConfirmPlan, useCurrentPlan, useGeneratePlan, useSkipMeal } from '@/features/plan/application/plan-queries';
import { groupByDay, type MealPlan, type PlannedMeal } from '@/features/plan/domain/plan';
import { BudgetCard } from '@/features/plan/ui/budget-card';
import { Spacing } from '@/shared/theme/colors';
import { AppText, Banner, Button, Card, EmptyState, ErrorState, LoadingState, Screen, TabHeader, TextLink } from '@/shared/ui';

const WEEK = { days: 7, slots: ['breakfast', 'lunch', 'dinner'] as const };

/** US-117 (plan semanal), US-139 (solo hoy), US-129 (cambiar), US-155 (motivo), US-127/132 (presupuesto). */
export function PlanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const plan = useCurrentPlan();
  const generate = useGeneratePlan();

  const generateWeek = () => generate.mutate({ start: todayIso(), days: WEEK.days, slots: [...WEEK.slots] });
  const generateToday = () => generate.mutate({ start: todayIso(), days: 1, slots: [...WEEK.slots] });

  return (
    <Screen scroll>
      <TabHeader
        title={t('plan.title')}
        actionIcon="person-circle-outline"
        actionLabel={t('profile.title')}
        onAction={() => router.push('/profile')}
      />
      {generate.error && <Banner tone="danger" message={t(errorKey(generate.error))} />}
      {plan.isPending ? (
        <LoadingState />
      ) : plan.isError ? (
        <ErrorState message={t(errorKey(plan.error))} onRetry={() => void plan.refetch()} />
      ) : !plan.data ? (
        <EmptyState
          message={t('plan.empty')}
          action={
            <View style={styles.actions}>
              <Button label={t('plan.generateWeek')} loading={generate.isPending} onPress={generateWeek} />
              <Button label={t('plan.generateToday')} variant="secondary" onPress={generateToday} />
            </View>
          }
        />
      ) : (
        <PlanView plan={plan.data} onRegenerate={generateWeek} regenerating={generate.isPending} />
      )}
      <HealthDisclaimerNote />
    </Screen>
  );
}

function PlanView({ plan, onRegenerate, regenerating }: { plan: MealPlan; onRegenerate: () => void; regenerating: boolean }) {
  const { t } = useTranslation();
  const confirm = useConfirmPlan();
  const draft = plan.status === 'draft';

  return (
    <>
      <AppText secondary>
        {t('plan.range', { start: formatDay(plan.startDate), end: formatDay(plan.endDate) })} · {t(`plan.status.${plan.status}`)}
      </AppText>
      <BudgetCard planId={plan.id} />
      {groupByDay(plan.meals).map((day) => (
        <Card key={day.date}>
          <AppText variant="subtitle">{day.date === todayIso() ? t('plan.today') : formatDay(day.date)}</AppText>
          {day.meals.map((meal) => (
            <MealRow key={meal.id} meal={meal} />
          ))}
        </Card>
      ))}
      {confirm.error && <Banner tone="danger" message={t(errorKey(confirm.error))} />}
      {draft && (
        <>
          <Button label={t('plan.confirm')} loading={confirm.isPending} onPress={() => confirm.mutate(plan.id)} />
          <Button label={t('plan.regenerate')} variant="secondary" loading={regenerating} onPress={onRegenerate} />
        </>
      )}
    </>
  );
}

function MealRow({ meal }: { meal: PlannedMeal }) {
  const { t } = useTranslation();
  const router = useRouter();
  const skip = useSkipMeal();
  const pending = meal.status === 'planned';

  return (
    <View style={styles.meal}>
      <AppText variant="caption" secondary>
        {`${t(`slots.${meal.slot}`)} · ${t(`plan.mealStatus.${meal.status}`)}`}
      </AppText>
      <TextLink
        label={meal.recipeTitle}
        onPress={() =>
          router.push({ pathname: '/recipe/[id]', params: { id: meal.recipeId, mealId: meal.id, servings: String(meal.servings) } })
        }
      />
      {meal.reasonCode && <AppText variant="caption" secondary>{t(`reasons.${meal.reasonCode}`)}</AppText>}
      {pending && (
        <View style={styles.mealActions}>
          <TextLink
            label={t('plan.swap')}
            hint={meal.recipeTitle}
            onPress={() =>
              router.push({ pathname: '/plan/swap/[mealId]', params: { mealId: meal.id, slot: meal.slot, recipeId: meal.recipeId } })
            }
          />
          <TextLink label={t('plan.skip')} hint={meal.recipeTitle} onPress={() => skip.mutate(meal.id)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: Spacing.sm, alignSelf: 'stretch' },
  meal: { paddingVertical: Spacing.xs, gap: 2 },
  mealActions: { flexDirection: 'row', gap: Spacing.lg },
});
