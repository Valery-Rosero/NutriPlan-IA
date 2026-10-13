import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { formatDay } from '@/core/format';
import { useCookingSuggestions } from '@/features/cooking/application/use-suggestions';
import { momentOfDay } from '@/features/cooking/domain/cooking';
import { SuggestionCard } from '@/features/cooking/ui/suggestion-card';
import { HealthDisclaimerNote } from '@/features/legal/ui/health-disclaimer-note';
import { usePantry } from '@/features/pantry/application/pantry-queries';
import { expiryStatus, todayIso } from '@/features/pantry/domain/pantry';
import { QuickAdd } from '@/features/pantry/ui/quick-add';
import { useCurrentPlan, useGeneratePlan } from '@/features/plan/application/plan-queries';
import { SLOT_ORDER } from '@/features/plan/domain/plan';
import { useRestrictions } from '@/features/profile/application/profile-queries';
import { useShoppingList } from '@/features/shopping/application/shopping-queries';
import { progress } from '@/features/shopping/domain/shopping';
import { Spacing } from '@/shared/theme/colors';
import { AppText, Banner, Button, Card, EmptyState, ErrorState, LoadingState, Screen, TabHeader, TextLink } from '@/shared/ui';

const WEEK = { days: 7, slots: ['breakfast', 'lunch', 'dinner'] as const };

/**
 * Hoy (ADR-024): responde "¿qué cocino?" con lo que hay en la cocina. Reúne en un solo lugar
 * lo planeado para hoy, ideas para este momento del día, el estado de la cocina y la semana.
 */
export function TodayScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const today = todayIso();
  const moment = momentOfDay(new Date().getHours());

  const pantry = usePantry();
  const plan = useCurrentPlan();
  const restrictions = useRestrictions();
  const suggestions = useCookingSuggestions(moment);
  const list = useShoppingList(plan.data?.id);
  const generate = useGeneratePlan();

  const items = pantry.data ?? [];
  const expiring = items.filter((i) => expiryStatus(i.expiresOn, today) === 'soon');
  const todayMeals = (plan.data?.meals ?? [])
    .filter((m) => m.date === today)
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
  const pendingToBuy = list.data ? progress(list.data.items) : null;

  return (
    <Screen scroll>
      <TabHeader
        title={t('today.title')}
        subtitle={formatDay(today)}
        actionIcon="person-circle-outline"
        actionLabel={t('profile.title')}
        onAction={() => router.push('/profile')}
      />

      {restrictions.data?.allergenIds.length === 0 && (
        <>
          <Banner tone="warning" message={t('cook.noAllergies')} />
          <TextLink
            label={t('cook.declareAllergies')}
            onPress={() => router.push({ pathname: '/profile/[section]', params: { section: 'restrictions' } })}
          />
        </>
      )}

      {/* 1. Mi cocina: sin ella las recetas no se pueden adaptar */}
      {pantry.isSuccess && items.length === 0 ? (
        <Card>
          <AppText variant="subtitle">{t('today.emptyKitchenTitle')}</AppText>
          <QuickAdd />
        </Card>
      ) : (
        <Card>
          <AppText variant="subtitle">{t('today.kitchenTitle')}</AppText>
          <AppText secondary>{t('today.kitchenCount', { count: items.length })}</AppText>
          {expiring.length > 0 && (
            <AppText variant="caption" secondary>{t('today.expiring', { list: expiring.map((i) => i.name).join(', ') })}</AppText>
          )}
          <TextLink label={t('today.openKitchen')} onPress={() => router.navigate('/kitchen')} />
        </Card>
      )}

      {/* 2. Lo planeado para hoy */}
      {todayMeals.length > 0 && (
        <Card>
          <AppText variant="subtitle">{t('today.planned')}</AppText>
          {todayMeals.map((meal) => (
            <View key={meal.id} style={styles.meal}>
              <AppText variant="caption" secondary>{`${t(`slots.${meal.slot}`)} · ${t(`plan.mealStatus.${meal.status}`)}`}</AppText>
              <TextLink
                label={meal.recipeTitle}
                onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: meal.recipeId, mealId: meal.id, servings: String(meal.servings) } })}
              />
            </View>
          ))}
        </Card>
      )}

      {/* 3. Ideas para este momento del día con lo que hay */}
      <AppText variant="subtitle">{t('today.suggestionsTitle', { moment: t(`slots.${moment}`) })}</AppText>
      <AppText variant="caption" secondary>{t('today.suggestionsHint')}</AppText>
      {suggestions.isPending ? (
        <LoadingState />
      ) : suggestions.isError ? (
        <ErrorState message={t(errorKey(suggestions.error))} onRetry={() => void suggestions.refetch()} />
      ) : suggestions.data.length === 0 ? (
        <EmptyState message={t('cook.empty')} />
      ) : (
        suggestions.data.slice(0, 4).map((s) => <SuggestionCard key={s.recipeId} suggestion={s} />)
      )}

      {/* 4. La semana y el mercado */}
      <Card>
        <AppText variant="subtitle">{t('today.weekTitle')}</AppText>
        {plan.data ? (
          <>
            <AppText secondary>{t('today.weekSummary', { count: plan.data.meals.filter((m) => m.status === 'planned').length })}</AppText>
            {pendingToBuy && pendingToBuy.total > pendingToBuy.done && (
              <AppText secondary>{t('today.toBuy', { count: pendingToBuy.total - pendingToBuy.done })}</AppText>
            )}
            <TextLink label={t('today.openWeek')} onPress={() => router.navigate('/week')} />
            <TextLink label={t('today.openList')} onPress={() => router.navigate({ pathname: '/kitchen', params: { tab: 'list' } })} />
          </>
        ) : (
          <>
            <AppText secondary>{t('today.weekPitch')}</AppText>
            {generate.error && <Banner tone="danger" message={t(errorKey(generate.error))} />}
            <Button
              label={t('today.organizeWeek')}
              loading={generate.isPending}
              onPress={() => generate.mutate({ start: today, days: WEEK.days, slots: [...WEEK.slots] }, { onSuccess: () => router.navigate('/week') })}
            />
          </>
        )}
      </Card>

      <HealthDisclaimerNote />
    </Screen>
  );
}

const styles = StyleSheet.create({ meal: { gap: 2, paddingVertical: Spacing.xs } });
