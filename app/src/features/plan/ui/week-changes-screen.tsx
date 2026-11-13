import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { foodEmoji } from '@/core/food-emoji';
import { capitalize, formatCOP, formatDay } from '@/core/format';
import { useApplyWeekChanges, useCurrentPlan, useWeekChanges } from '@/features/plan/application/plan-queries';
import { WEEK_GOALS, type WeekChange, type WeekGoal } from '@/features/plan/domain/plan';
import { Spacing } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';
import {
  AppText,
  Banner,
  BrandHeader,
  Button,
  Card,
  Checkbox,
  Chip,
  ChipGroup,
  EmptyState,
  ErrorState,
  FoodTile,
  LoadingState,
  Pill,
  Screen,
} from '@/shared/ui';

/** Lee la meta y lo que hay que evitar de la ruta (/plan/changes?goal=cheaper&avoid=id1,id2&avoidNames=Tomate). */
function useWeekParams() {
  const { goal, avoid, avoidNames } = useLocalSearchParams<{ goal?: string; avoid?: string; avoidNames?: string }>();
  const parsedGoal = (WEEK_GOALS as readonly string[]).includes(goal ?? '') ? (goal as WeekGoal) : null;
  const ids = avoid ? avoid.split(',').filter(Boolean) : [];
  const names = avoidNames ? avoidNames.split(',').filter(Boolean) : [];
  return { goal: parsedGoal, avoid: ids, avoidNames: names };
}

/**
 * US-174 · "Revisa los cambios": antes → después de cada comida pendiente que cambiaría para la meta elegida
 * (lo calcula la base con recetas seguras). Se marca o desmarca cada cambio; nada se toca hasta "Aplicar".
 */
export function WeekChangesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useWeekParams();
  const [goal, setGoal] = useState<WeekGoal | null>(params.goal);
  const plan = useCurrentPlan();
  const planId = plan.data?.id;
  const proposal = useWeekChanges(planId, goal, params.avoid);
  const apply = useApplyWeekChanges();
  // Desmarcados por la persona (todo llega marcado).
  const [off, setOff] = useState<Set<string>>(new Set());

  const changes = useMemo(() => (proposal.data ?? []).filter((c) => c.newRecipeId), [proposal.data]);
  const unresolved = (proposal.data ?? []).filter((c) => c.reason === 'avoid_unresolved');
  const chosen = changes.filter((c) => !off.has(c.plannedMealId));
  const saving = chosen.reduce((sum, c) => sum + (c.saving ?? 0), 0);
  const avoidList = params.avoidNames.join(', ');

  const toggle = (id: string) =>
    setOff((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const pickGoal = (g: WeekGoal) => {
    setOff(new Set());
    setGoal((current) => (current === g && params.avoid.length > 0 ? null : g));
  };

  const subtitle = [goal ? t(`plan.week.goals.${goal}`) : null, avoidList ? t('plan.week.without', { list: avoidList }) : null]
    .filter(Boolean)
    .join(' · ');

  const body = () => {
    // isLoading y no isPending: sin plan la consulta está apagada y quedaría "pendiente" para siempre.
    if (plan.isPending || proposal.isLoading) return <LoadingState />;
    if (!planId) {
      return (
        <EmptyState
          icon="calendar-outline"
          message={t('plan.week.noPlan')}
          action={<Button label={t('plan.week.seeWeek')} flavor="mango" onPress={() => router.navigate('/week')} />}
        />
      );
    }
    if (proposal.isError) return <ErrorState message={t(errorKey(proposal.error))} onRetry={() => void proposal.refetch()} />;
    if (apply.isSuccess) {
      return (
        <>
          <Banner tone="success" message={t('plan.week.applied', { count: apply.data })} />
          <Button label={t('plan.week.seeWeek')} icon="calendar-outline" flavor="mango" onPress={() => router.navigate('/week')} />
        </>
      );
    }
    return (
      <>
        {changes.length === 0 && unresolved.length === 0 && <EmptyState icon="checkmark-circle-outline" message={t('plan.week.empty')} />}
        {changes.map((change) => (
          <ChangeCard
            key={change.plannedMealId}
            change={change}
            checked={!off.has(change.plannedMealId)}
            onToggle={() => toggle(change.plannedMealId)}
            avoidList={avoidList}
          />
        ))}
        {unresolved.map((u) => (
          <Banner key={u.plannedMealId} tone="warning" message={t('plan.week.unresolved', { title: u.currentTitle, day: dayLabel(u, t), list: avoidList })} />
        ))}
        {changes.length > 0 && (
          <>
            {saving > 0 && (
              <AppText variant="subtitle" accessibilityLiveRegion="polite">{t('plan.week.totalSaving', { amount: formatCOP(saving) })}</AppText>
            )}
            {apply.error && <Banner tone="danger" message={t(errorKey(apply.error))} />}
            <Button
              label={t('plan.week.apply', { count: chosen.length })}
              icon="checkmark"
              flavor="mango"
              disabled={chosen.length === 0}
              loading={apply.isPending}
              onPress={() =>
                apply.mutate({ planId, changes: chosen.map((c) => ({ plannedMealId: c.plannedMealId, recipeId: c.newRecipeId! })) })
              }
            />
            <AppText variant="caption" secondary style={styles.center}>{t('plan.week.hint')}</AppText>
          </>
        )}
      </>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '' }} />
      <Screen scroll>
        <BrandHeader title={t('plan.week.title')} subtitle={subtitle || undefined} flavor="mango" />
        {!apply.isSuccess && (
          <ChipGroup>
            {WEEK_GOALS.map((g) => (
              <Chip key={g} label={t(`plan.week.goals.${g}`)} selected={goal === g} flavor="mango" onPress={() => pickGoal(g)} />
            ))}
          </ChipGroup>
        )}
        {body()}
      </Screen>
    </>
  );
}

const dayLabel = (c: WeekChange, t: (k: string) => string) => `${capitalize(formatDay(c.date))} · ${t(`slots.${c.slot}`)}`;

/** Una comida: antes (tachado) → después, con el porqué. Se marca o desmarca entera. */
function ChangeCard({ change, checked, onToggle, avoidList }: {
  change: WeekChange;
  checked: boolean;
  onToggle: () => void;
  avoidList: string;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  const minutesLess = change.newMinutes !== null ? change.currentMinutes - change.newMinutes : 0;
  return (
    <Card style={!checked && styles.off}>
      <Checkbox
        checked={checked}
        onChange={onToggle}
        flavor="basil"
        label={dayLabel(change, t)}>
        {/* Antes → después: lo tachado es el plato actual (el lector dice "antes" y "después", no solo el tachado). */}
        <View style={styles.diff}>
          <View style={styles.row} accessible accessibilityLabel={t('plan.week.before', { title: change.currentTitle })}>
            <FoodTile emoji={foodEmoji(change.currentTitle)} flavor="mango" size={36} />
            <AppText secondary style={[styles.flex, { textDecorationLine: 'line-through', color: c.textSecondary }]}>{change.currentTitle}</AppText>
          </View>
          <View style={styles.row} accessible accessibilityLabel={t('plan.week.after', { title: change.newTitle })}>
            <FoodTile emoji={foodEmoji(change.newTitle ?? '')} flavor="basil" size={36} />
            <AppText variant="subtitle" style={styles.flex}>{change.newTitle}</AppText>
          </View>
        </View>
      </Checkbox>
      <View style={styles.pills}>
        {change.saving !== null && change.saving > 0 && <Pill label={`−${formatCOP(change.saving)}`} tone="accent" icon="trending-down-outline" />}
        {minutesLess >= 10 && <Pill label={t('plan.week.minutesLess', { count: minutesLess })} tone="accent" icon="time-outline" />}
        <Pill
          label={change.reason === 'avoid' ? t('plan.week.without', { list: avoidList }) : t(`plan.week.reasons.${change.reason}`)}
          tone="mango"
          icon="sparkles-outline"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  off: { opacity: 0.6 },
  diff: { gap: Spacing.xs, marginTop: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  center: { textAlign: 'center' },
});
