import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { foodEmoji } from '@/core/food-emoji';
import { useBuyNext } from '@/features/pantry/application/pantry-queries';
import { useCurrentPlan } from '@/features/plan/application/plan-queries';
import { useAddMissingToList, useShoppingList } from '@/features/shopping/application/shopping-queries';
import { Spacing } from '@/shared/theme/colors';
import { AppText, Banner, Button, Card, FoodTile, IconBadge } from '@/shared/ui';

/**
 * ADR-030 · "Para completar más recetas": qué comprar para terminar recetas que casi se pueden hacer. Lo calcula
 * la base (what_to_buy_next) con lo que le falta a cada receta segura para la persona: exacto, no adivinado.
 */
export function BuyNextCard() {
  const { t } = useTranslation();
  const buyNext = useBuyNext();
  const plan = useCurrentPlan();
  const list = useShoppingList(plan.data?.id);
  const add = useAddMissingToList();
  const items = buyNext.data ?? [];
  if (items.length === 0) return null;

  return (
    <Card variant="filled">
      <View style={styles.row}>
        <IconBadge name="bulb-outline" tone="mango" />
        <View style={styles.flex}>
          <AppText variant="subtitle" accessibilityRole="header">{t('pantry.buyNext.title')}</AppText>
          <AppText variant="caption" secondary>{t('pantry.buyNext.hint')}</AppText>
        </View>
      </View>
      {items.map((item) => (
        <View key={item.ingredientId} style={styles.row} accessible>
          <FoodTile emoji={foodEmoji(item.name, '🛒')} flavor="mango" size={40} />
          <View style={styles.flex}>
            <AppText variant="label">{item.name}</AppText>
            <AppText variant="caption" secondary>
              {item.completes > 0
                ? t('pantry.buyNext.completes', { count: item.completes, list: item.recipes.join(', ') })
                : t('pantry.buyNext.helps', { list: item.recipes.join(', ') })}
            </AppText>
          </View>
        </View>
      ))}
      {add.isSuccess ? (
        <Banner tone="success" message={t('pantry.buyNext.added')} />
      ) : list.data ? (
        <Button
          label={t('pantry.buyNext.add')}
          icon="cart-outline"
          variant="secondary"
          flavor="mango"
          size="sm"
          loading={add.isPending}
          onPress={() => add.mutate({ list: list.data!, items: items.map((i) => ({ ingredientId: i.ingredientId, grams: i.grams })) })}
        />
      ) : null}
      {add.error && <Banner tone="danger" message={t(errorKey(add.error))} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1, gap: Spacing.xxs },
});
