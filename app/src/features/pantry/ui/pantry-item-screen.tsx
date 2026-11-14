import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { foodEmoji } from '@/core/food-emoji';
import { formatGrams } from '@/core/format';
import {
  usePantry,
  useRemovePantryItem,
  useSetPantryAmount,
  useSetPantryExpiry,
} from '@/features/pantry/application/pantry-queries';
import {
  addDays,
  amountOf,
  daysBetween,
  EXPIRY_OPTIONS,
  expiryFor,
  expiryStatus,
  mergeLots,
  pantryKey,
  STILL_GOOD_DAYS,
  stepFor,
  todayIso,
  type ExpiryKey,
  type PantryItem,
} from '@/features/pantry/domain/pantry';
import { Spacing } from '@/shared/theme/colors';
import {
  AppText,
  Banner,
  Button,
  Card,
  Chip,
  ChipGroup,
  ConfirmDialog,
  EmptyState,
  FoodTile,
  IconButton,
  LoadingState,
  Screen,
  TextLink,
} from '@/shared/ui';

const FRACTIONS = [
  { key: 'q3', value: 0.75 },
  { key: 'half', value: 0.5 },
  { key: 'q1', value: 0.25 },
  { key: 'none', value: 0 },
] as const;

/**
 * ADR-034 · C3: tocar un alimento de "Lo que tengo" → cambiar cuánto queda (− / +, ¾ ½ ¼, "se acabó"),
 * la fecha de cada compra, o quitarlo. Si está vencido, "todavía sirve" o quitarlo (M2).
 */
export function PantryItemScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { key } = useLocalSearchParams<{ key: string }>();
  const pantry = usePantry();
  const today = todayIso();
  const item = (pantry.data ? mergeLots(pantry.data, today) : []).find((i) => pantryKey(i) === key);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: item?.name ?? t('pantry.edit.title') }} />
      <Screen scroll>
        {pantry.isPending ? (
          <LoadingState />
        ) : !item ? (
          <>
            <EmptyState message={t('pantry.edit.gone')} icon="checkmark-circle-outline" />
            <Button label={t('pantry.edit.back')} variant="secondary" onPress={() => router.back()} />
          </>
        ) : (
          <ItemEditor key={`${pantryKey(item)}-${amountOf(item)}`} item={item} onDone={() => router.back()} />
        )}
      </Screen>
    </>
  );
}

function ItemEditor({ item, onDone }: { item: PantryItem; onDone: () => void }) {
  const { t } = useTranslation();
  const today = todayIso();
  const expired = expiryStatus(item.expiresOn, today) === 'expired';
  const [confirmRemove, setConfirmRemove] = useState(false);
  const remove = useRemovePantryItem();
  const expiry = useSetPantryExpiry();
  const lots = item.lots ?? [item];

  return (
    <>
      <Card variant="filled" style={styles.head}>
        <FoodTile emoji={foodEmoji(item.name, '🥫')} flavor={expired ? 'tomato' : 'basil'} size={56} />
        <View style={styles.flex}>
          <AppText variant="heading">{item.name}</AppText>
          <AppText variant="caption" secondary>{describeAmount(item, amountOf(item), t)}</AppText>
          {lots.length > 1 && <AppText variant="caption" secondary>{t('pantry.edit.lots', { count: lots.length })}</AppText>}
        </View>
      </Card>

      {expired ? (
        <Card>
          <AppText>{t('pantry.edit.expiredNote')}</AppText>
          <Button
            label={t('pantry.stillGood')}
            icon="checkmark"
            flavor="basil"
            loading={expiry.isPending}
            hint={t('pantry.stillGoodHint', { name: item.name })}
            onPress={() => expiry.mutate({ item, expiresOn: addDays(today, STILL_GOOD_DAYS) }, { onSuccess: onDone })}
          />
        </Card>
      ) : (
        <AmountEditor item={item} onDone={onDone} />
      )}

      <AppText variant="subtitle" accessibilityRole="header">{t('pantry.edit.until')}</AppText>
      {lots.map((lot) => (
        <LotExpiry key={lot.id} lot={lot} showAmount={lots.length > 1} shelfLifeDays={item.shelfLifeDays ?? null} />
      ))}
      {expiry.error && <Banner tone="danger" message={t(errorKey(expiry.error))} />}

      <View style={styles.removeRow}>
        <Button label={t('pantry.edit.removeAll')} icon="trash-outline" variant="ghost" onPress={() => setConfirmRemove(true)} />
      </View>
      {remove.error && <Banner tone="danger" message={t(errorKey(remove.error))} />}
      <ConfirmDialog
        visible={confirmRemove}
        icon="trash-outline"
        title={t('pantry.removeTitle', { name: item.name })}
        confirmLabel={t('pantry.remove')}
        cancelLabel={t('common.cancel')}
        danger
        loading={remove.isPending}
        onConfirm={() => remove.mutate(item, { onSuccess: onDone, onSettled: () => setConfirmRemove(false) })}
        onCancel={() => setConfirmRemove(false)}
      />
    </>
  );
}

/** − / +, fracciones y "se acabó": se arma el nuevo valor y se guarda una sola vez. */
function AmountEditor({ item, onDone }: { item: PantryItem; onDone: () => void }) {
  const { t } = useTranslation();
  const original = amountOf(item);
  const step = stepFor(item);
  const [amount, setAmount] = useState(original);
  const save = useSetPantryAmount();
  const changed = Math.abs(amount - original) > 0.001;
  const stepLabel = describeAmount(item, step, t);

  return (
    <Card>
      <AppText variant="subtitle" accessibilityRole="header">{t('pantry.edit.howMuch')}</AppText>
      <View style={styles.stepper}>
        <IconButton
          icon="remove-circle-outline"
          size={36}
          tone="primary"
          label={t('pantry.edit.decrease', { step: stepLabel })}
          disabled={amount <= 0}
          onPress={() => setAmount((a) => Math.max(0, round2(a - step)))}
        />
        <AppText variant="title" accessibilityLiveRegion="polite" style={styles.value}>
          {amount <= 0 ? t('pantry.edit.fractions.none') : describeAmount(item, amount, t)}
        </AppText>
        <IconButton
          icon="add-circle-outline"
          size={36}
          tone="primary"
          label={t('pantry.edit.increase', { step: stepLabel })}
          onPress={() => setAmount((a) => round2(a + step))}
        />
      </View>
      <ChipGroup>
        {FRACTIONS.map((f) => (
          <Chip
            key={f.key}
            label={t(`pantry.edit.fractions.${f.key}`)}
            selected={Math.abs(amount - round2(original * f.value)) < 0.001}
            flavor={f.key === 'none' ? 'tomato' : 'basil'}
            onPress={() => setAmount(round2(original * f.value))}
          />
        ))}
      </ChipGroup>
      {save.error && <Banner tone="danger" message={t(errorKey(save.error))} />}
      <Button
        label={amount <= 0 ? t('pantry.edit.saveEmpty') : t('pantry.edit.save')}
        icon="checkmark"
        variant={amount <= 0 ? 'danger' : 'primary'}
        disabled={!changed}
        loading={save.isPending}
        onPress={() => save.mutate({ item, amount }, { onSuccess: onDone })}
      />
    </Card>
  );
}

/** La fecha de una compra: se ve y se cambia con un toque (lo normal para ese alimento primero). */
function LotExpiry({ lot, showAmount, shelfLifeDays }: { lot: PantryItem; showAmount: boolean; shelfLifeDays: number | null }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const expiry = useSetPantryExpiry();
  const today = todayIso();
  const status = expiryStatus(lot.expiresOn, today);
  const when =
    status === 'none'
      ? t('pantry.noExpiry')
      : status === 'expired'
        ? t('pantry.expired')
        : t('pantry.expiresIn', { count: daysBetween(today, lot.expiresOn!) });
  const amount = describeAmount(lot, amountOf(lot), t);
  const keys: ExpiryKey[] = [...(shelfLifeDays ? (['auto'] as const) : []), ...EXPIRY_OPTIONS.map((o) => o.key)];

  return (
    <Card style={styles.lot}>
      <View style={styles.lotRow}>
        <AppText style={styles.flex}>{showAmount ? `${amount} · ${when}` : when}</AppText>
        <TextLink
          label={open ? t('common.cancel') : t('pantry.edit.changeDate')}
          hint={t('pantry.edit.changeDateHint', { amount })}
          onPress={() => setOpen((o) => !o)}
        />
      </View>
      {open && (
        <ChipGroup>
          {keys.map((k) => (
            <Chip
              key={k}
              label={k === 'auto' ? t('pantry.expiryOptions.auto', { count: shelfLifeDays ?? 0 }) : t(`pantry.expiryOptions.${k}`)}
              selected={false}
              flavor="basil"
              onPress={() => expiry.mutate({ item: lot, expiresOn: expiryFor(k, shelfLifeDays, today) }, { onSuccess: () => setOpen(false) })}
            />
          ))}
        </ChipGroup>
      )}
      {expiry.error && <Banner tone="danger" message={t(errorKey(expiry.error))} />}
    </Card>
  );
}

/** "1,5 kg · ≈ 3 unidades" (catálogo) o "2 unidades" (alimento propio, en su unidad). */
function describeAmount(item: PantryItem, amount: number, t: (k: string, o?: Record<string, unknown>) => string) {
  if (item.custom) {
    return t('pantry.custom.amount', { quantity: amount.toLocaleString('es-CO'), unit: t(`pantry.custom.units.${item.custom.unit}`) });
  }
  const grams = formatGrams(amount);
  if (!item.unitGrams || !item.unitName) return grams;
  const units = Math.round((amount / item.unitGrams) * 2) / 2; // de a media unidad
  return units > 0 ? `${grams} · ${t('pantry.edit.approx', { count: units, unit: units === 1 ? item.unitName : plural(item.unitName) })}` : grams;
}

/** "unidad" → "unidades", "diente" → "dientes" (los nombres de unidad vienen en singular). */
const plural = (word: string) => (/[aeiouáéíóú]$/i.test(word) ? `${word}s` : `${word}es`);

const round2 = (n: number) => Math.round(n * 100) / 100;

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  value: { flex: 1, textAlign: 'center' },
  lot: { gap: Spacing.sm, paddingVertical: Spacing.sm },
  lotRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  removeRow: { paddingTop: Spacing.sm },
});
