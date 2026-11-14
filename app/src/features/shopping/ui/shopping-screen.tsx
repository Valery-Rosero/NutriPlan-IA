import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { formatGrams } from '@/core/format';
import { useCurrentPlan } from '@/features/plan/application/plan-queries';
import {
  listKeyFor,
  useAddManualItem,
  useGenerateList,
  useMoveToPantry,
  useRemoveItem,
  useRestoreItem,
  useShoppingList,
  useToggleItem,
} from '@/features/shopping/application/shopping-queries';
import { useSubstitutes } from '@/features/recipes/application/recipe-queries';
import { substitutesByIngredient } from '@/features/recipes/domain/recipe';
import { buyLabel, pendingToPantry, progress, splitClosed, toSections, type ShoppingItem } from '@/features/shopping/domain/shopping';
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
  TextField,
  TextLink,
} from '@/shared/ui';

/**
 * US-124 (desde el plan), US-125 (resta la despensa), US-126 (marcar, quitar, agregar), US-135 (secciones).
 * ADR-035: sin plan se usa la lista de la casa (A1); las cantidades van como se compran (A2); quitar se deshace (M5).
 */
export function ShoppingScreen({ header }: { header?: ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const online = useIsOnline();
  const plan = useCurrentPlan();
  const planId = plan.data?.id;
  const list = useShoppingList(planId, plan.isSuccess);
  const generate = useGenerateList();

  const body = () => {
    if (plan.isPending || list.isPending) return <LoadingState />;
    if (plan.isError || list.isError) {
      return <ErrorState message={t(errorKey(plan.error ?? list.error))} onRetry={() => void list.refetch()} />;
    }
    if (!planId) {
      // A1: sin plan, la lista de la casa (se anota igual; al organizar la semana pasa a esa lista).
      return (
        <>
          <Card variant="filled">
            <AppText secondary>{t('shopping.house.note')}</AppText>
            <TextLink label={t('shopping.goToPlan')} icon="calendar-outline" onPress={() => router.navigate('/week')} />
          </Card>
          {list.data && <ListView listKey={listKeyFor(undefined)} listId={list.data.id} items={list.data.items} house />}
        </>
      );
    }
    if (!list.data) {
      return (
        <EmptyState
          icon="cart-outline"
          message={t('shopping.noList')}
          action={<Button label={t('shopping.build')} flavor="basil" loading={generate.isPending} onPress={() => generate.mutate(planId)} />}
        />
      );
    }
    return (
      <ListView
        listKey={listKeyFor(planId)}
        listId={list.data.id}
        items={list.data.items}
        onRefresh={() => generate.mutate(planId)}
        refreshing={generate.isPending}
      />
    );
  };

  // Vive dentro de Mi cocina (D1); el encabezado de Mi cocina se desplaza con la lista (A3).
  return (
    <ScrollView contentContainerStyle={styles.embedded} keyboardShouldPersistTaps="handled">
      {header}
      {!online && <Banner tone="warning" message={t('common.offline')} />}
      {generate.error && <Banner tone="danger" message={t(errorKey(generate.error))} />}
      {body()}
    </ScrollView>
  );
}

function ListView({ listKey, listId, items, onRefresh, refreshing = false, house = false }: {
  /** Clave de la lista en caché: el plan o 'house'. */
  listKey: string;
  listId: string;
  items: ShoppingItem[];
  onRefresh?: () => void;
  refreshing?: boolean;
  house?: boolean;
}) {
  const { t } = useTranslation();
  const toggle = useToggleItem();
  const remove = useRemoveItem();
  const restore = useRestoreItem();
  // M5: lo último que se quitó, para poder deshacerlo.
  const [removed, setRemoved] = useState<ShoppingItem | null>(null);
  const add = useAddManualItem();
  const move = useMoveToPantry();
  const [newItem, setNewItem] = useState('');
  const { open, closed } = splitClosed(items);
  const { done, total } = progress(open);
  const toPantry = pendingToPantry(open);
  // Todo lo que había que comprar ya se compró y pasó a la despensa: la compra terminó.
  const allBought = total === 0 && closed > 0;
  // US-147: sustitutos de lo que aún falta comprar del plan (una sola consulta para toda la lista).
  const swappable = open.filter((i) => i.source === 'plan' && !i.checked && i.ingredientId && (i.toBuyGrams ?? 0) > 0);
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
      <Card>
        {allBought ? (
          <>
            <View style={styles.progressRow}>
              <IconBadge name="checkmark-done-outline" tone="accent" />
              <View style={styles.flex}>
                <AppText variant="subtitle" accessibilityLiveRegion="polite">{t('shopping.allBoughtTitle')}</AppText>
                <AppText variant="caption" secondary>{t('shopping.allBoughtBody')}</AppText>
              </View>
            </View>
            {onRefresh && (
              <Button label={t('shopping.checkAgain')} icon="refresh" variant="secondary" flavor="basil" size="sm" loading={refreshing} onPress={onRefresh} />
            )}
          </>
        ) : (
          <>
            <View style={styles.progressRow}>
              <IconBadge name="cart-outline" tone="accent" />
              <AppText variant="subtitle" style={styles.flex} accessibilityLiveRegion="polite">
                {t('shopping.progress', { done, total })}
              </AppText>
              {onRefresh && <IconButton icon="refresh" label={t('shopping.refresh')} tone="basil" disabled={refreshing} onPress={onRefresh} />}
            </View>
            <ProgressBar value={total ? done / total : 0} label={t('shopping.progress', { done, total })} tone="accent" />
            {closed > 0 && <AppText variant="caption" secondary>{t('shopping.closed', { count: closed })}</AppText>}
          </>
        )}
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
              flavor="basil"
              size="sm"
              loading={move.isPending || record.isPending}
              onPress={moveAndRecord}
            />
          </>
        )}
        {record.isSuccess && <Banner tone="success" message={t('spending.recorded')} />}
        {record.error && <Banner tone="danger" message={t(errorKey(record.error))} />}
      </Card>

      {removed && (
        <Card variant="filled" style={styles.undo}>
          <AppText style={styles.flex} accessibilityLiveRegion="polite">{t('shopping.removed', { name: removed.name })}</AppText>
          <TextLink
            label={t('shopping.undo')}
            icon="arrow-undo-outline"
            onPress={() => restore.mutate(removed.id, { onSuccess: () => setRemoved(null) })}
          />
        </Card>
      )}

      {house && open.length === 0 && <EmptyState icon="cart-outline" message={t('shopping.house.empty')} />}

      {toSections(open).map((section) =>
        section.kind === 'have' ? (
          <Card key={section.key} variant="filled">
            <View style={styles.sectionHead}>
              <IconBadge name="checkmark-done-outline" tone="accent" size={32} />
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
                planId={listKey}
                label={rowLabel(item, t)}
                substitutes={item.ingredientId ? substitutes.get(item.ingredientId) : undefined}
                onToggle={(checked) => toggle.mutate({ planId: listKey, itemId: item.id, checked })}
                onRemove={() => remove.mutate(item.id, { onSuccess: () => setRemoved(item) })}
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
          flavor="basil"
          size="sm"
          disabled={newItem.trim().length === 0}
          loading={add.isPending}
          onPress={submitNew}
        />
      </Card>

      {(move.error ?? remove.error ?? restore.error ?? add.error) && (
        <Banner tone="danger" message={t(errorKey(move.error ?? remove.error ?? restore.error ?? add.error))} />
      )}

      {/* El gasto del mes va al final: arriba, lo que hay que comprar (A3). */}
      <MonthlySpendCard />
    </>
  );
}

/** A2: "Ahuyama · un pedazo pequeño", "Pollo · 1 libra y media" (como se pide en la plaza). */
function rowLabel(item: ShoppingItem, t: (k: string, o?: Record<string, unknown>) => string) {
  if (!item.toBuyGrams) return item.name;
  const buy = buyLabel(item, t);
  if (buy) return `${item.name} · ${buy}`;
  const grams = formatGrams(item.toBuyGrams);
  return `${item.name} · ${item.approxUnits ? t('shopping.units', { count: item.approxUnits, grams }) : grams}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  embedded: { gap: Spacing.md, paddingBottom: Spacing.lg },
  undo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
});
