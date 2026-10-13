import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { pendingToPantry, progress, toSections, type ShoppingItem } from '@/features/shopping/domain/shopping';
import { useIsOnline } from '@/shared/hooks/use-is-online';
import { Spacing } from '@/shared/theme/colors';
import { AppText, Banner, Button, Card, Checkbox, EmptyState, ErrorState, LoadingState, Screen, TextField, TextLink } from '@/shared/ui';

/** US-124 (desde el plan), US-125 (resta la despensa), US-126 (marcar, quitar, agregar), US-135 (secciones). */
export function ShoppingScreen() {
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
      return <EmptyState message={t('shopping.noPlan')} action={<Button label={t('shopping.goToPlan')} onPress={() => router.navigate('/plan')} />} />;
    }
    if (!list.data) {
      return (
        <EmptyState
          message={t('shopping.noList')}
          action={<Button label={t('shopping.build')} loading={generate.isPending} onPress={() => generate.mutate(planId)} />}
        />
      );
    }
    return <ListView planId={planId} listId={list.data.id} items={list.data.items} onRefresh={() => generate.mutate(planId)} refreshing={generate.isPending} />;
  };

  return (
    <Screen scroll>
      <AppText variant="title">{t('shopping.title')}</AppText>
      {!online && <Banner tone="warning" message={t('common.offline')} />}
      {generate.error && <Banner tone="danger" message={t(errorKey(generate.error))} />}
      {body()}
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

  return (
    <>
      <AppText secondary accessibilityLiveRegion="polite">{t('shopping.progress', { done, total })}</AppText>
      <Button label={t('shopping.refresh')} variant="secondary" loading={refreshing} onPress={onRefresh} />

      {toSections(items).map((section) => (
        <Card key={section.key}>
          <AppText variant="subtitle">
            {section.kind === 'have' ? t('shopping.haveSection') : (section.title ?? t('shopping.otherSection'))}
          </AppText>
          {section.data.map((item) =>
            section.kind === 'have' ? (
              <AppText key={item.id} secondary>{`${item.name} · ${t('shopping.youHave', { amount: formatGrams(item.pantryGrams) })}`}</AppText>
            ) : (
              <View key={item.id} style={styles.item}>
                <Checkbox
                  checked={item.checked}
                  onChange={(checked) => toggle.mutate({ planId, itemId: item.id, checked })}
                  label={item.toBuyGrams ? `${item.name} · ${amount(item, t)}` : item.name}
                />
                <TextLink label={t('shopping.remove')} hint={item.name} onPress={() => remove.mutate(item.id)} />
              </View>
            ),
          )}
        </Card>
      ))}

      <TextField label={t('shopping.addLabel')} value={newItem} onChangeText={setNewItem} placeholder={t('shopping.addPlaceholder')} />
      <Button
        label={t('shopping.add')}
        variant="secondary"
        disabled={newItem.trim().length === 0}
        loading={add.isPending}
        onPress={() => add.mutate({ listId, name: newItem }, { onSuccess: () => setNewItem('') })}
      />

      {(move.error ?? remove.error ?? add.error) && <Banner tone="danger" message={t(errorKey(move.error ?? remove.error ?? add.error))} />}
      {move.isSuccess && <Banner tone="success" message={t('shopping.moved', { count: move.data })} />}
      {toPantry > 0 && (
        <Button label={t('shopping.moveToPantry', { count: toPantry })} loading={move.isPending} onPress={() => move.mutate(listId)} />
      )}
    </>
  );
}

function amount(item: ShoppingItem, t: (k: string, o?: Record<string, unknown>) => string) {
  const grams = formatGrams(item.toBuyGrams ?? 0);
  return item.approxUnits ? t('shopping.units', { count: item.approxUnits, grams }) : grams;
}

const styles = StyleSheet.create({
  item: { gap: 0, paddingVertical: Spacing.xs },
});
