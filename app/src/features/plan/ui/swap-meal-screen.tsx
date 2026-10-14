import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import type { MealSlot } from '@/features/cooking/domain/cooking';
import { SLOT_ICON } from '@/features/cooking/ui/slot-icon';
import { useAlternatives, useSwapMeal } from '@/features/plan/application/plan-queries';
import { Spacing } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';
import { AppText, Banner, Card, EmptyState, ErrorState, IconBadge, LoadingState, Pill, Screen } from '@/shared/ui';

/** US-129: cambiar una comida por otra receta elegible para ese momento del día. */
export function SwapMealScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useTheme();
  const { mealId, slot, recipeId } = useLocalSearchParams<{ mealId: string; slot: MealSlot; recipeId: string }>();
  const alternatives = useAlternatives(slot, recipeId);
  const swap = useSwapMeal();

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('plan.swapTitle') }} />
      <Screen scroll>
        <View style={styles.row}>
          <IconBadge name={SLOT_ICON[slot] ?? 'restaurant-outline'} tone="accent" />
          <AppText secondary style={styles.flex}>{t('plan.swapHint', { slot: t(`slots.${slot}`) })}</AppText>
        </View>
        {swap.error && <Banner tone="danger" message={t(errorKey(swap.error))} />}
        {alternatives.isPending ? (
          <LoadingState />
        ) : alternatives.isError ? (
          <ErrorState message={t(errorKey(alternatives.error))} onRetry={() => void alternatives.refetch()} />
        ) : alternatives.data.length === 0 ? (
          <EmptyState icon="restaurant-outline" message={t('plan.noAlternatives')} />
        ) : (
          alternatives.data.map((r) => (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              accessibilityLabel={`${r.title} · ${t('cook.minutes', { count: r.totalMinutes })}`}
              accessibilityState={{ disabled: swap.isPending }}
              disabled={swap.isPending}
              onPress={() => swap.mutate({ mealId, recipeId: r.id, previousRecipeId: recipeId }, { onSuccess: () => router.back() })}
              style={({ pressed }) => (pressed || swap.isPending) && styles.dim}>
              <Card>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <AppText variant="subtitle">{r.title}</AppText>
                    <Pill label={t('cook.minutes', { count: r.totalMinutes })} icon="time-outline" />
                  </View>
                  <Ionicons name="swap-horizontal" size={22} color={c.primary} />
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1, gap: Spacing.xs },
  dim: { opacity: 0.6 },
});
