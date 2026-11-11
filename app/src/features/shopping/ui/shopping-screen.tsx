import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { formatGrams } from '@/core/format';
import { useCurrentPlan } from '@/features/plan/application/plan-queries';
import {
  useAddManualItem,
  useGenerateList,
  useMoveToPantry,
  useRemoveItem,
  useShoppingList,
  useToggleItem,
} from '@/features/shopping/application/shopping-queries';
import { useSubstitutes } from '@/features/recipes/application/recipe-queries';
import { substitutesByIngredient } from '@/features/recipes/domain/recipe';
import { pendingToPantry, progress, toSections, type ShoppingItem } from '@/features/shopping/domain/shopping';
import { ShoppingRow } from '@/features/shopping/ui/shopping-row';
import { parseCop } from '@/features/profile/domain/profile';
import { useRecordPurchase } from '@/features/spending/application/use-spending';
import { MonthlySpendCard } from '@/features/spending/ui/monthly-spend-card';
import { useIsOnline } from '@/shared/hooks/use-is-online';
import { Spacing } from '@/shared/theme/colors';
import {
  AppText,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconBadge,
  IconButton,
  LoadingState,
  ProgressBar,
  Screen,
  TextField,
} from '@/shared/ui';

/** US-124 (desde el plan), US-125 (resta la despensa), US-126 (marcar, quitar, agregar), US-135 (secciones). */
export function ShoppingScreen({ embedded }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const online = useIsOnline();
  const plan = useCurrentPlan();
  const planId = plan.data?.id;
  const list = useShoppingList(planId);
  const generate = useGenerateList();

  const body = () => {
    if (plan.isPending || (planId && list.isPending)) return <LoadingState />;
    if (plan.isError || list.isError) {
      return <ErrorState message={t(errorKey(plan.error ?? list.error))} onRetry={() => void list.refetch()} />;
    }
    if (!planId) {
      return <EmptyState icon="calendar-outline" message={t('shopping.noPlan')} action={<Button label={t('shopping.goToPlan')} onPress={() => router.navigate('/week')} />} />;
    }
    if (!list.data) {
      return (
        <EmptyState
          icon="cart-outline"
          message={t('shopping.noList')}
          action={<Button label={t('shopping.build')} loading={generate.isPending} onPress={() => generate.mutate(planId)} />}
        />
      );
    }
    return <ListView planId={planId} listId={list.data.id} items={list.data.items} onRefresh={() => generate.mutate(planId)} refreshing={generate.isPending} />;
  };

  const content = (
    <>
      {!online && <Banner tone="warning" message={t('common.offline')} />}
      {generate.error && <Banner tone="danger" message={t(errorKey(generate.error))} />}
      {body()}
    </>
  );
  if (embedded) return <ScrollView contentContainerStyle={styles.embedded}>{content}</ScrollView>;
  return (
    <Screen scroll>
      <AppText variant="title">{t('shopping.title')}</AppText>
      {content}
    </Screen>
  );
}

function ListView({ planId, listId, items, onRefresh, refreshing }: {
  planId: string;
  listId: string;
  items: ShoppingItem[];
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { t } = useTranslation();
  const toggle = useToggleItem();
  const remove = useRemoveItem();
  const add = useAddManualItem();
  const move = useMoveToPantry();
  const [newItem, setNewItem] = useState('');
  const { done, total } = progress(items);
  const toPantry = pendingToPantry(items);
  // US-147: sustitutos de lo que aún falta comprar del plan (una sola consulta para toda la lista).
  const swappable = items.filter((i) => i.source === 'plan' && !i.checked && i.ingredientId && (i.toBuyGrams ?? 0) > 0);
  const substitutes = substitutesByIngredient(useSubstitutes(swappable.map((i) => i.ingredientId!)).data ?? []);
  const record = useRecordPurchase();
  const [paid, setPaid] = useState('');
  const moveAndRecord = () =>
    move.mutate(listId, {
      onSuccess: () => {
        const total = parseCop(paid);
        if (total) record.mutate({ total, listId });
        setPaid('');
      },
    });
  const submitNew = () => {
    if (newItem.trim()) add.mutate({ listId, name: newItem }, { onSuccess: () => setNewItem('') });
  };

  return (
    <>
      <MonthlySpendCard />
      <Card variant="primary">
        <View style={styles.progressRow}>
          <IconBadge name="cart-outline" tone="accent" />
          <AppText variant="subtitle" style={styles.flex} accessibilityLiveRegion="polite">
            {t('shopping.progress', { done, total })}
          </AppText>
          <IconButton icon="refresh" label={t('shopping.refresh')} tone="primary" disabled={refreshing} onPress={onRefresh} />
        </View>
        <ProgressBar value={total ? done / total : 0} label={t('shopping.progress', { done, total })} />
        {move.isSuccess && <Banner tone="success" message={t('shopping.moved', { count: move.data })} />}
        {toPantry > 0 && (
          <>
            {/* US-141: lo pagado de verdad alimenta el gasto del mes. Es opcional: no frena pasar a la despensa. */}
            <TextField
              label={t('spending.paidLabel')}
              icon="cash-outline"
              value={paid}
              onChangeText={setPaid}
              keyboardType="number-pad"
              placeholder="45000"
            />
            <Button
              label={t('shopping.moveToPantry', { count: toPantry })}
              icon="basket-outline"
              size="sm"
              loading={move.isPending || record.isPending}
              onPress={moveAndRecord}
            />
          </>
        )}
        {record.isSuccess && <Banner tone="success" message={t('spending.recorded')} />}
        {record.error && <Banner tone="danger" message={t(errorKey(record.error))} />}
      </Card>

      {toSections(items).map((section) =>
        section.kind === 'have' ? (
          <Card key={section.key} variant="filled">
            <View style={styles.sectionHead}>
              <IconBadge name="checkmark-done-outline" size={32} />
              <AppText variant="subtitle" style={styles.flex}>{t('shopping.haveSection')}</AppText>
            </View>
            {section.data.map((item) => (
              <AppText key={item.id} secondary>{`${item.name} · ${t('shopping.youHave', { amount: formatGrams(item.pantryGrams) })}`}</AppText>
            ))}
          </Card>
        ) : (
          <Card key={section.key}>
            <AppText variant="heading">{section.title ?? t('shopping.otherSection')}</AppText>
            {section.data.map((item) => (
              <ShoppingRow
                key={item.id}
                item={item}
                planId={planId}
                label={item.toBuyGrams ? `${item.name} · ${amount(item, t)}` : item.name}
                substitutes={item.ingredientId ? substitutes.get(item.ingredientId) : undefined}
                onToggle={(checked) => toggle.mutate({ planId, itemId: item.id, checked })}
                onRemove={() => remove.mutate(item.id)}
              />
            ))}
          </Card>
        ),
      )}

      <Card variant="outlined">
        <TextField
          label={t('shopping.addLabel')}
          icon="add-circle-outline"
          value={newItem}
          onChangeText={setNewItem}
          placeholder={t('shopping.addPlaceholder')}
          returnKeyType="done"
          onSubmitEditing={submitNew}
        />
        <Button
          label={t('shopping.add')}
          variant="secondary"
          size="sm"
          disabled={newItem.trim().length === 0}
          loading={add.isPending}
          onPress={submitNew}
        />
      </Card>

      {(move.error ?? remove.error ?? add.error) && <Banner tone="danger" message={t(errorKey(move.error ?? remove.error ?? add.error))} />}
    </>
  );
}

function amount(item: ShoppingItem, t: (k: string, o?: Record<string, unknown>) => string) {
  const grams = formatGrams(item.toBuyGrams ?? 0);
  return item.approxUnits ? t('shopping.units', { count: item.approxUnits, grams }) : grams;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  embedded: { gap: Spacing.md, paddingBottom: Spacing.lg },
});
