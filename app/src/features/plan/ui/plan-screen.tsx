import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { capitalize, formatDay } from '@/core/format';
import { SLOT_ICON } from '@/features/cooking/ui/slot-icon';
import { HealthDisclaimerNote } from '@/features/legal/ui/health-disclaimer-note';
import { todayIso } from '@/features/pantry/domain/pantry';
import { useConfirmPlan, useCurrentPlan, useGeneratePlan, useSkipMeal } from '@/features/plan/application/plan-queries';
import { groupByDay, type MealPlan, type PlannedMeal } from '@/features/plan/domain/plan';
import { BudgetCard } from '@/features/plan/ui/budget-card';
import { Spacing } from '@/shared/theme/colors';
import {
  AppText,
  Banner,
  BrandHeader,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  IconBadge,
  LoadingState,
  Pill,
  ProgressBar,
  Screen,
  SectionHeader,
  TextLink,
} from '@/shared/ui';

const WEEK = { days: 7, slots: ['breakfast', 'lunch', 'dinner'] as const };

/** US-117 (plan semanal), US-139 (solo hoy), US-129 (cambiar), US-155 (motivo), US-127/132 (presupuesto). */
export function PlanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const plan = useCurrentPlan();
  const generate = useGeneratePlan();

  const generateWeek = () => generate.mutate({ start: todayIso(), days: WEEK.days, slots: [...WEEK.slots] });
  const generateToday = () => generate.mutate({ start: todayIso(), days: 1, slots: [...WEEK.slots] });
  const data = plan.data;

  return (
    <Screen scroll>
      <BrandHeader
        title={t('plan.title')}
        subtitle={data ? t('plan.range', { start: formatDay(data.startDate), end: formatDay(data.endDate) }) : t('plan.pitch')}
        action={{ icon: 'person-circle-outline', label: t('profile.title'), onPress: () => router.push('/profile') }}>
        {data && <WeekSummary plan={data} />}
      </BrandHeader>
      {generate.error && <Banner tone="danger" message={t(errorKey(generate.error))} />}
      {plan.isPending ? (
        <LoadingState />
      ) : plan.isError ? (
        <ErrorState message={t(errorKey(plan.error))} onRetry={() => void plan.refetch()} />
      ) : !data ? (
        <EmptyState
          icon="calendar-outline"
          message={t('plan.empty')}
          action={
            <View style={styles.actions}>
              <Button label={t('plan.generateWeek')} icon="sparkles-outline" loading={generate.isPending} onPress={generateWeek} />
              <Button label={t('plan.generateToday')} variant="secondary" onPress={generateToday} />
            </View>
          }
        />
      ) : (
        <PlanView plan={data} onRegenerate={generateWeek} regenerating={generate.isPending} />
      )}
      <HealthDisclaimerNote />
    </Screen>
  );
}

/** Estado y avance del plan, dentro del bloque de marca. */
function WeekSummary({ plan }: { plan: MealPlan }) {
  const { t } = useTranslation();
  const cooked = plan.meals.filter((m) => m.status === 'cooked').length;
  return (
    <View style={styles.summary}>
      <View style={styles.pills}>
        <Pill
          label={t(`plan.status.${plan.status}`)}
          tone={plan.status === 'draft' ? 'warning' : 'primary'}
          icon={plan.status === 'draft' ? 'create-outline' : 'checkmark-circle-outline'}
        />
        <Pill label={t('plan.cookedCount', { done: cooked, total: plan.meals.length })} icon="restaurant-outline" />
      </View>
      <ProgressBar value={plan.meals.length ? cooked / plan.meals.length : 0} label={t('plan.cookedCount', { done: cooked, total: plan.meals.length })} />
    </View>
  );
}

function PlanView({ plan, onRegenerate, regenerating }: { plan: MealPlan; onRegenerate: () => void; regenerating: boolean }) {
  const { t } = useTranslation();
  const confirm = useConfirmPlan();
  const today = todayIso();

  return (
    <>
      {/* Un borrador se revisa y se confirma: la acción va arriba, no al final de la semana. */}
      {plan.status === 'draft' && (
        <Card variant="primary">
          <View style={styles.row}>
            <IconBadge name="create-outline" tone="accent" />
            <View style={styles.flex}>
              <AppText variant="subtitle">{t('plan.draftTitle')}</AppText>
              <AppText variant="caption" secondary>{t('plan.draftHint')}</AppText>
            </View>
          </View>
          {confirm.error && <Banner tone="danger" message={t(errorKey(confirm.error))} />}
          <Button label={t('plan.confirm')} icon="checkmark" loading={confirm.isPending} onPress={() => confirm.mutate(plan.id)} />
          <Button label={t('plan.regenerate')} icon="refresh" variant="ghost" loading={regenerating} onPress={onRegenerate} />
        </Card>
      )}

      <BudgetCard planId={plan.id} />

      {groupByDay(plan.meals).map((day) => {
        const isToday = day.date === today;
        return (
          <View key={day.date} style={styles.day}>
            <View style={styles.dayHeader}>
              <SectionHeader title={capitalize(formatDay(day.date))} />
              {isToday && <Pill label={t('plan.today')} tone="accent" icon="today-outline" />}
            </View>
            <Card variant={isToday ? 'elevated' : 'outlined'}>
              {day.meals.map((meal, index) => (
                <View key={meal.id}>
                  {index > 0 && <Divider />}
                  <MealRow meal={meal} />
                </View>
              ))}
            </Card>
          </View>
        );
      })}
    </>
  );
}

function MealRow({ meal }: { meal: PlannedMeal }) {
  const { t } = useTranslation();
  const router = useRouter();
  const skip = useSkipMeal();
  const pending = meal.status === 'planned';

  return (
    <View style={[styles.meal, !pending && styles.done]}>
      <IconBadge name={SLOT_ICON[meal.slot]} tone={meal.status === 'cooked' ? 'primary' : 'neutral'} size={36} />
      <View style={styles.flex}>
        <View style={styles.slotRow}>
          <AppText variant="caption" secondary>{capitalize(t(`slots.${meal.slot}`))}</AppText>
          {!pending && (
            <Pill
              label={t(`plan.mealStatus.${meal.status}`)}
              tone={meal.status === 'cooked' ? 'primary' : 'neutral'}
              icon={meal.status === 'cooked' ? 'checkmark' : 'remove'}
            />
          )}
        </View>
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
              icon="swap-horizontal"
              hint={meal.recipeTitle}
              onPress={() =>
                router.push({ pathname: '/plan/swap/[mealId]', params: { mealId: meal.id, slot: meal.slot, recipeId: meal.recipeId } })
              }
            />
            <TextLink label={t('plan.skip')} icon="play-skip-forward-outline" hint={meal.recipeTitle} onPress={() => skip.mutate(meal.id)} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: Spacing.sm, alignSelf: 'stretch' },
  summary: { gap: Spacing.sm, marginTop: Spacing.xs },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  day: { gap: Spacing.sm },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  meal: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.sm },
  done: { opacity: 0.75 },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  mealActions: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.xs },
});
