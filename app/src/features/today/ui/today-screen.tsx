import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { formatDay } from '@/core/format';
import { useCookingSuggestions } from '@/features/cooking/application/use-suggestions';
import { momentOfDay, type MealSlot } from '@/features/cooking/domain/cooking';
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
import { greetingFor } from '@/features/today/domain/greeting';
import { MinTouch, Spacing } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';
import {
  AppText,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconBadge,
  LoadingState,
  Pill,
  ProgressBar,
  Screen,
  SectionHeader,
  TextLink,
  type IconName,
} from '@/shared/ui';

const WEEK = { days: 7, slots: ['breakfast', 'lunch', 'dinner'] as const };

const SLOT_ICON: Record<MealSlot, IconName> = {
  breakfast: 'cafe-outline',
  lunch: 'restaurant-outline',
  snack: 'nutrition-outline',
  dinner: 'moon-outline',
};

/**
 * Hoy (ADR-024): responde "¿qué cocino?" con lo que hay en la cocina. Orden de lectura:
 * la pregunta del momento, lo planeado, ideas con lo que hay, y el estado de la cocina y la semana.
 */
export function TodayScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useTheme();
  const today = todayIso();
  const hour = new Date().getHours();
  const moment = momentOfDay(hour);

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
  const weekMeals = plan.data?.meals ?? [];
  const pendingMeals = weekMeals.filter((m) => m.status === 'planned').length;
  const pendingToBuy = list.data ? progress(list.data.items) : null;

  return (
    <Screen scroll>
      {/* La pregunta del momento, en el bloque de marca */}
      <Card variant="brand" style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.flex}>
            <AppText variant="label" tone="onBrandMuted">{t(`today.greeting.${greetingFor(hour)}`)}</AppText>
            <AppText variant="caption" tone="onBrandMuted">{formatDay(today)}</AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('profile.title')}
            hitSlop={8}
            onPress={() => router.push('/profile')}
            style={({ pressed }) => [styles.profile, pressed && styles.pressed]}>
            <Ionicons name="person-circle-outline" size={32} color={c.onBrand} />
          </Pressable>
        </View>
        <AppText variant="title" tone="onBrand">{t('today.suggestionsTitle', { moment: t(`slots.${moment}`) })}</AppText>
        <AppText tone="onBrandMuted">{t('today.heroHint')}</AppText>
      </Card>

      {restrictions.data?.allergenIds.length === 0 && (
        <View style={styles.block}>
          <Banner tone="warning" message={t('cook.noAllergies')} />
          <TextLink
            label={t('cook.declareAllergies')}
            icon="shield-checkmark-outline"
            onPress={() => router.push({ pathname: '/profile/[section]', params: { section: 'restrictions' } })}
          />
        </View>
      )}

      {/* Sin cocina las recetas no se pueden adaptar: es lo primero que se pide */}
      {pantry.isSuccess && items.length === 0 && (
        <Card variant="primary">
          <View style={styles.row}>
            <IconBadge name="basket-outline" tone="accent" />
            <AppText variant="heading" style={styles.flex}>{t('today.emptyKitchenTitle')}</AppText>
          </View>
          <QuickAdd />
        </Card>
      )}

      {/* Lo planeado para hoy */}
      {todayMeals.length > 0 && (
        <>
          <SectionHeader title={t('today.planned')} />
          <Card>
            {todayMeals.map((meal) => (
              <View key={meal.id} style={styles.row}>
                <IconBadge name={SLOT_ICON[meal.slot]} />
                <View style={styles.flex}>
                  <AppText variant="caption" secondary>{capitalize(t(`slots.${meal.slot}`))}</AppText>
                  <TextLink
                    label={meal.recipeTitle}
                    onPress={() =>
                      router.push({ pathname: '/recipe/[id]', params: { id: meal.recipeId, mealId: meal.id, servings: String(meal.servings) } })
                    }
                  />
                </View>
                {meal.status !== 'planned' && (
                  <Pill
                    label={t(`plan.mealStatus.${meal.status}`)}
                    tone={meal.status === 'cooked' ? 'primary' : 'neutral'}
                    icon={meal.status === 'cooked' ? 'checkmark' : 'remove'}
                  />
                )}
              </View>
            ))}
          </Card>
        </>
      )}

      {/* Ideas para este momento del día con lo que hay */}
      <SectionHeader title={t('today.ideasTitle')} />
      <AppText variant="caption" secondary style={styles.hint}>{t('today.suggestionsHint')}</AppText>
      {suggestions.isPending ? (
        <LoadingState />
      ) : suggestions.isError ? (
        <ErrorState message={t(errorKey(suggestions.error))} onRetry={() => void suggestions.refetch()} />
      ) : suggestions.data.length === 0 ? (
        <EmptyState message={t('cook.empty')} icon="restaurant-outline" />
      ) : (
        suggestions.data.slice(0, 4).map((s) => <SuggestionCard key={s.recipeId} suggestion={s} />)
      )}

      {/* La cocina y la semana */}
      <SectionHeader title={t('today.statusTitle')} />
      {items.length > 0 && (
        <Card>
          <View style={styles.row}>
            <IconBadge name="basket-outline" tone="accent" />
            <View style={styles.flex}>
              <AppText variant="subtitle">{t('today.kitchenTitle')}</AppText>
              <AppText secondary>{t('today.kitchenCount', { count: items.length })}</AppText>
            </View>
          </View>
          {expiring.length > 0 && (
            <Banner tone="warning" message={t('today.expiring', { list: expiring.map((i) => i.name).join(', ') })} />
          )}
          <TextLink label={t('today.openKitchen')} icon="arrow-forward" onPress={() => router.navigate('/kitchen')} />
        </Card>
      )}

      <Card>
        <View style={styles.row}>
          <IconBadge name="calendar-outline" />
          <AppText variant="subtitle" style={styles.flex}>{t('today.weekTitle')}</AppText>
        </View>
        {plan.data ? (
          <>
            <ProgressBar
              value={weekMeals.length ? 1 - pendingMeals / weekMeals.length : 0}
              label={t('today.weekProgress')}
            />
            <AppText secondary>{t('today.weekSummary', { count: pendingMeals })}</AppText>
            {pendingToBuy && pendingToBuy.total > pendingToBuy.done && (
              <AppText secondary>{t('today.toBuy', { count: pendingToBuy.total - pendingToBuy.done })}</AppText>
            )}
            <TextLink label={t('today.openWeek')} icon="arrow-forward" onPress={() => router.navigate('/week')} />
            <TextLink
              label={t('today.openList')}
              icon="cart-outline"
              onPress={() => router.navigate({ pathname: '/kitchen', params: { tab: 'list' } })}
            />
          </>
        ) : (
          <>
            <AppText secondary>{t('today.weekPitch')}</AppText>
            {generate.error && <Banner tone="danger" message={t(errorKey(generate.error))} />}
            <Button
              label={t('today.organizeWeek')}
              icon="sparkles-outline"
              loading={generate.isPending}
              onPress={() =>
                generate.mutate({ start: today, days: WEEK.days, slots: [...WEEK.slots] }, { onSuccess: () => router.navigate('/week') })
              }
            />
          </>
        )}
      </Card>

      <HealthDisclaimerNote />
    </Screen>
  );
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const styles = StyleSheet.create({
  hero: { padding: Spacing.lg, gap: Spacing.sm },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  profile: { minWidth: MinTouch, minHeight: MinTouch, alignItems: 'flex-end', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  block: { gap: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  hint: { marginTop: -Spacing.sm },
});
