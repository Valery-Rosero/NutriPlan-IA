import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey, toAppError } from '@/core/errors/app-error';
import { foodEmoji } from '@/core/food-emoji';
import { capitalize, formatDay } from '@/core/format';
import { SLOT_EMOJI } from '@/features/cooking/ui/slot-icon';
import { HealthDisclaimerNote } from '@/features/legal/ui/health-disclaimer-note';
import { todayIso } from '@/features/pantry/domain/pantry';
import { useConfirmPlan, useCurrentPlan, useGeneratePlan, useSkipMeal } from '@/features/plan/application/plan-queries';
import { calendarDays, calendarLayout, initialDayIndex, planDates, type CalendarDay } from '@/features/plan/domain/calendar';
import { HORIZON_DAYS, horizonOf, WEEK_GOALS, type Horizon, type MealPlan, type PlannedMeal } from '@/features/plan/domain/plan';
import { BudgetCard } from '@/features/plan/ui/budget-card';
import { DayPager } from '@/features/plan/ui/day-pager';
import { PlanCalendar } from '@/features/plan/ui/plan-calendar';
import { MonthlySpendCard } from '@/features/spending/ui/monthly-spend-card';
import { CookTimeNotice } from '@/features/profile/ui/cook-time-notice';
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
  Divider,
  EmptyState,
  ErrorState,
  FoodTile,
  IconBadge,
  IconButton,
  LoadingState,
  Pill,
  ProgressBar,
  Screen,
  SectionHeader,
  SegmentedControl,
  TextLink,
} from '@/shared/ui';

const SLOTS = ['breakfast', 'lunch', 'dinner'] as const;

/** Hoy · Semana · Mes. */
function HorizonPicker({ value, onChange }: { value: Horizon; onChange: (h: Horizon) => void }) {
  const { t } = useTranslation();
  return (
    <SegmentedControl
      label={t('plan.horizon.label')}
      flavor="mango"
      value={value}
      onChange={onChange}
      options={(['day', 'week', 'month'] as const).map((h) => ({ value: h, label: t(`plan.horizon.${h}`) }))}
    />
  );
}

/** US-117 (plan semanal), US-139 (solo hoy), US-129 (cambiar), US-155 (motivo), US-127/132 (presupuesto). */
export function PlanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const plan = useCurrentPlan();
  const generate = useGeneratePlan();

  const data = plan.data;
  // B2: hoy, semana o mes. Con un plan en borrador, "volver a generar" parte de su misma duración.
  const [horizon, setHorizon] = useState<Horizon>('week');
  const generateFor = (h: Horizon) => generate.mutate({ start: todayIso(), days: HORIZON_DAYS[h], slots: [...SLOTS] });

  return (
    <Screen scroll>
      <BrandHeader
        title={t('plan.title')}
        flavor="mango"
        subtitle={data ? t('plan.range', { start: formatDay(data.startDate), end: formatDay(data.endDate) }) : t('plan.pitch')}
        action={{ icon: 'person-circle-outline', label: t('profile.title'), onPress: () => router.push('/profile') }}>
        {data && <WeekSummary plan={data} />}
      </BrandHeader>
      {generate.error && <Banner tone="danger" message={t(errorKey(generate.error))} />}
      {generate.error && toAppError(generate.error).code === 'no_eligible_recipes' && <CookTimeNotice />}
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
              <HorizonPicker value={horizon} onChange={setHorizon} />
              <Button label={t(`plan.generate.${horizon}`)} icon="sparkles-outline" flavor="mango" loading={generate.isPending} onPress={() => generateFor(horizon)} />
            </View>
          }
        />
      ) : (
        <PlanView key={data.id} plan={data} onRegenerate={generateFor} regenerating={generate.isPending} />
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
          tone={plan.status === 'draft' ? 'mango' : 'accent'}
          icon={plan.status === 'draft' ? 'create-outline' : 'checkmark-circle-outline'}
        />
        <Pill label={t('plan.cookedCount', { done: cooked, total: plan.meals.length })} icon="restaurant-outline" />
      </View>
      <ProgressBar value={plan.meals.length ? cooked / plan.meals.length : 0} label={t('plan.cookedCount', { done: cooked, total: plan.meals.length })} tone="accent" />
    </View>
  );
}

function PlanView({ plan, onRegenerate, regenerating }: { plan: MealPlan; onRegenerate: (h: Horizon) => void; regenerating: boolean }) {
  const { t } = useTranslation();
  const c = useTheme();
  const confirm = useConfirmPlan();
  const [horizon, setHorizon] = useState<Horizon>(() => horizonOf(planDates(plan).length));
  const today = todayIso();
  const days = calendarDays(plan, today);
  const [index, setIndex] = useState(() => initialDayIndex(days, today));
  const selected = days[Math.min(index, days.length - 1)];

  return (
    <>
      {/* Un borrador se revisa y se confirma: la acción va arriba. */}
      {plan.status === 'draft' && (
        <Card variant="filled" style={{ backgroundColor: c.mangoContainer }}>
          <View style={styles.row}>
            <IconBadge name="create-outline" tone="mango" />
            <View style={styles.flex}>
              <AppText variant="subtitle">{t('plan.draftTitle')}</AppText>
              <AppText variant="caption" secondary>{t('plan.draftHint')}</AppText>
            </View>
          </View>
          {confirm.error && <Banner tone="danger" message={t(errorKey(confirm.error))} />}
          <Button label={t('plan.confirm')} icon="checkmark" flavor="mango" loading={confirm.isPending} onPress={() => confirm.mutate(plan.id)} />
          <HorizonPicker value={horizon} onChange={setHorizon} />
          <Button label={t(`plan.regenerateFor.${horizon}`)} icon="refresh" variant="ghost" loading={regenerating} onPress={() => onRegenerate(horizon)} />
        </Card>
      )}

      {/* B1: el calendario arriba y, debajo, un día por página (se pasa deslizando, como un libro). */}
      <Card variant="outlined">
        <PlanCalendar
          days={days}
          layout={calendarLayout(plan)}
          selected={selected?.date ?? ''}
          today={today}
          onSelect={(date) => setIndex(Math.max(0, days.findIndex((d) => d.date === date)))}
        />
      </Card>
      <DayPager
        days={days}
        index={index}
        onIndexChange={setIndex}
        renderDay={(day, i) => (
          <DayPage day={day} hasPrev={i > 0} hasNext={i < days.length - 1} onPrev={() => setIndex(i - 1)} onNext={() => setIndex(i + 1)} />
        )}
      />

      {plan.meals.some((m) => m.status === 'planned') && <ImproveWeekCard />}
      <BudgetCard planId={plan.id} />
      <MonthlySpendCard />
    </>
  );
}

/** US-174: cambios a toda la semana con una meta (también se le puede pedir al asistente con palabras). */
function ImproveWeekCard() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Card variant="filled">
      <View style={styles.row}>
        <IconBadge name="sparkles-outline" tone="mango" />
        <View style={styles.flex}>
          <AppText variant="subtitle" accessibilityRole="header">{t('plan.week.improveTitle')}</AppText>
          <AppText variant="caption" secondary>{t('plan.week.improveHint')}</AppText>
        </View>
      </View>
      <ChipGroup>
        {WEEK_GOALS.map((g) => (
          <Chip
            key={g}
            label={t(`plan.week.goals.${g}`)}
            selected={false}
            onPress={() => router.push({ pathname: '/plan/changes', params: { goal: g } })}
          />
        ))}
      </ChipGroup>
    </Card>
  );
}

/** Una página del libro: el día con sus comidas en orden. */
function DayPage({ day, hasPrev, hasNext, onPrev, onNext }: {
  day: CalendarDay;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card variant={day.isToday ? 'elevated' : 'outlined'}>
      <View style={styles.dayHeader}>
        <IconButton icon="chevron-back" label={t('plan.calendar.prevDay')} disabled={!hasPrev} onPress={onPrev} />
        <View style={styles.dayTitle}>
          <SectionHeader title={capitalize(formatDay(day.date))} />
          {day.isToday && <Pill label={t('plan.today')} tone="mango" icon="today-outline" />}
        </View>
        <IconButton icon="chevron-forward" label={t('plan.calendar.nextDay')} disabled={!hasNext} onPress={onNext} />
      </View>
      {day.meals.length === 0 ? (
        <AppText secondary>{t('plan.calendar.emptyDay')}</AppText>
      ) : (
        day.meals.map((meal, i) => (
          <View key={meal.id}>
            {i > 0 && <Divider />}
            <MealRow meal={meal} />
          </View>
        ))
      )}
      {day.extras.length > 0 && (
        <View style={styles.extras}>
          <Divider />
          <View>
            <AppText variant="label">{t('plan.extras.title')}</AppText>
            <AppText variant="caption" secondary>{t('plan.extras.hint')}</AppText>
          </View>
          {day.extras.map((meal) => (
            <ExtraRow key={meal.id} meal={meal} />
          ))}
        </View>
      )}
    </Card>
  );
}

/** Plato adicional: lo que se cocinó fuera del plan ese día (siempre cocinado; no se cambia ni se omite). */
function ExtraRow({ meal }: { meal: PlannedMeal }) {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useTheme();
  return (
    <View style={[styles.meal, styles.extra, { borderColor: c.mango }]}>
      <FoodTile emoji={foodEmoji(meal.recipeTitle, SLOT_EMOJI[meal.slot])} flavor="mango" size={44} />
      <View style={styles.flex}>
        <View style={styles.slotRow}>
          <AppText variant="caption" secondary>{capitalize(t(`slots.${meal.slot}`))}</AppText>
          <Pill label={t('plan.extras.badge')} tone="mango" icon="add-circle-outline" />
        </View>
        <TextLink label={meal.recipeTitle} onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: meal.recipeId } })} />
      </View>
    </View>
  );
}

function MealRow({ meal }: { meal: PlannedMeal }) {
  const { t } = useTranslation();
  const router = useRouter();
  const skip = useSkipMeal();
  const pending = meal.status === 'planned';

  return (
    <View style={[styles.meal, !pending && styles.done]}>
      <FoodTile emoji={foodEmoji(meal.recipeTitle, SLOT_EMOJI[meal.slot])} flavor={meal.status === 'cooked' ? 'basil' : 'mango'} size={44} />
      <View style={styles.flex}>
        <View style={styles.slotRow}>
          <AppText variant="caption" secondary>{capitalize(t(`slots.${meal.slot}`))}</AppText>
          {!pending && (
            <Pill
              label={t(`plan.mealStatus.${meal.status}`)}
              tone={meal.status === 'cooked' ? 'accent' : 'neutral'}
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
        {pending && (
          <TextLink
            label={t('assistant.askForMeal')}
            icon="sparkles-outline"
            hint={meal.recipeTitle}
            onPress={() => router.push({ pathname: '/assistant', params: { mealId: meal.id, mealTitle: meal.recipeTitle } })}
          />
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
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  dayTitle: { flex: 1, alignItems: 'center', gap: Spacing.xs },
  meal: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.sm },
  done: { opacity: 0.75 },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  mealActions: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.xs },
  extras: { gap: Spacing.sm },
  extra: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: Radius.md, paddingHorizontal: Spacing.sm },
});
