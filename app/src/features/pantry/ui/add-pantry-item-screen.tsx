import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useAddToPantry, useIngredientSearch, useUnits } from '@/features/pantry/application/pantry-queries';
import { addDays, todayIso, unitsFor, type IngredientOption } from '@/features/pantry/domain/pantry';
import { MinTouch, Spacing } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';
import { Radius } from '@/shared/theme/tokens';
import { AppText, Banner, Button, Card, Chip, ChipGroup, IconBadge, IconButton, Screen, TextField } from '@/shared/ui';

const EXPIRY_OPTIONS = [
  { key: 'none', days: null },
  { key: 'days3', days: 3 },
  { key: 'week1', days: 7 },
  { key: 'week2', days: 14 },
  { key: 'month1', days: 30 },
] as const;

/** Agregar a la despensa: buscar (sin tildes y con errores de tipeo), cantidad, unidad y vencimiento. */
export function AddPantryItemScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useTheme();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<IngredientOption | null>(null);
  const [quantity, setQuantity] = useState('');
  const [unitId, setUnitId] = useState<number | null>(null);
  const [expiry, setExpiry] = useState<(typeof EXPIRY_OPTIONS)[number]['key']>('none');
  const results = useIngredientSearch(selected ? '' : query);
  const units = useUnits();
  const add = useAddToPantry();

  const amount = Number(quantity.replace(',', '.'));
  const options = selected && units.data ? unitsFor(selected, units.data) : [];
  const unit = unitId ?? options[0]?.id ?? null;
  const valid = !!selected && unit !== null && amount > 0;

  const submit = () => {
    if (!selected || unit === null) return;
    const days = EXPIRY_OPTIONS.find((o) => o.key === expiry)?.days ?? null;
    add.mutate(
      { ingredientId: selected.id, quantity: amount, unitId: unit, expiresOn: days === null ? null : addDays(todayIso(), days) },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('pantry.add') }} />
      <Screen scroll>
        {!selected ? (
          <>
            <TextField label={t('pantry.search')} icon="search" value={query} onChangeText={setQuery} autoFocus autoCorrect={false} placeholder={t('pantry.searchPlaceholder')} />
            {results.isError && <Banner tone="danger" message={t(errorKey(results.error))} />}
            {query.trim().length >= 2 && results.data?.length === 0 && <AppText secondary>{t('pantry.noResults')}</AppText>}
            {results.data?.map((ingredient) => (
              <Pressable
                key={ingredient.id}
                accessibilityRole="button"
                onPress={() => setSelected(ingredient)}
                style={({ pressed }) => [
                  styles.result,
                  { borderColor: c.divider, backgroundColor: pressed ? c.surface : c.card },
                ]}>
                <Ionicons name="leaf-outline" size={18} color={c.primary} />
                <AppText style={styles.flex}>{ingredient.name}</AppText>
                <Ionicons name="add-circle-outline" size={22} color={c.textSecondary} />
              </Pressable>
            ))}
          </>
        ) : (
          <>
            <Card variant="primary" style={styles.selected}>
              <IconBadge name="leaf-outline" tone="accent" />
              <AppText variant="heading" style={styles.flex}>{selected.name}</AppText>
              <IconButton
                icon="swap-horizontal"
                label={t('pantry.change')}
                tone="primary"
                onPress={() => {
                  setSelected(null);
                  setUnitId(null);
                }}
              />
            </Card>
            <TextField label={t('pantry.quantity')} icon="scale-outline" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" autoFocus />
            <AppText variant="label">{t('pantry.unit')}</AppText>
            <ChipGroup>
              {options.map((u) => (
                <Chip key={u.id} label={u.name} selected={u.id === unit} onPress={() => setUnitId(u.id)} />
              ))}
            </ChipGroup>
            <View style={styles.labelRow}>
              <Ionicons name="calendar-outline" size={16} color={c.textSecondary} />
              <AppText variant="label">{t('pantry.expiry')}</AppText>
            </View>
            <ChipGroup>
              {EXPIRY_OPTIONS.map((o) => (
                <Chip key={o.key} label={t(`pantry.expiryOptions.${o.key}`)} selected={expiry === o.key} onPress={() => setExpiry(o.key)} />
              ))}
            </ChipGroup>
            {add.error && <Banner tone="danger" message={t(errorKey(add.error))} />}
            <Button label={t('pantry.save')} icon="checkmark" disabled={!valid} loading={add.isPending} onPress={submit} />
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  result: {
    minHeight: MinTouch + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  flex: { flex: 1 },
  selected: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
});
