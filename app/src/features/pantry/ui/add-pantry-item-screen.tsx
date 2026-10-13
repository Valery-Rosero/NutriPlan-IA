import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useAddToPantry, useIngredientSearch, useUnits } from '@/features/pantry/application/pantry-queries';
import { addDays, todayIso, unitsFor, type IngredientOption } from '@/features/pantry/domain/pantry';
import { MinTouch, Spacing } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';
import { AppText, Banner, Button, Chip, ChipGroup, Screen, TextField } from '@/shared/ui';

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
            <TextField label={t('pantry.search')} value={query} onChangeText={setQuery} autoFocus autoCorrect={false} placeholder={t('pantry.searchPlaceholder')} />
            {results.isError && <Banner tone="danger" message={t(errorKey(results.error))} />}
            {query.trim().length >= 2 && results.data?.length === 0 && <AppText secondary>{t('pantry.noResults')}</AppText>}
            {results.data?.map((ingredient) => (
              <Pressable
                key={ingredient.id}
                accessibilityRole="button"
                onPress={() => setSelected(ingredient)}
                style={[styles.result, { borderColor: c.border, backgroundColor: c.surface }]}>
                <AppText>{ingredient.name}</AppText>
              </Pressable>
            ))}
          </>
        ) : (
          <>
            <AppText variant="subtitle">{selected.name}</AppText>
            <TextField label={t('pantry.quantity')} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" autoFocus />
            <AppText secondary>{t('pantry.unit')}</AppText>
            <ChipGroup>
              {options.map((u) => (
                <Chip key={u.id} label={u.name} selected={u.id === unit} onPress={() => setUnitId(u.id)} />
              ))}
            </ChipGroup>
            <AppText secondary>{t('pantry.expiry')}</AppText>
            <ChipGroup>
              {EXPIRY_OPTIONS.map((o) => (
                <Chip key={o.key} label={t(`pantry.expiryOptions.${o.key}`)} selected={expiry === o.key} onPress={() => setExpiry(o.key)} />
              ))}
            </ChipGroup>
            {add.error && <Banner tone="danger" message={t(errorKey(add.error))} />}
            <Button label={t('pantry.save')} disabled={!valid} loading={add.isPending} onPress={submit} />
            <Button label={t('pantry.change')} variant="secondary" onPress={() => { setSelected(null); setUnitId(null); }} />
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  result: { minHeight: MinTouch, justifyContent: 'center', paddingHorizontal: Spacing.md, borderWidth: 1, borderRadius: 12 },
});
