import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useAddCustomToPantry, useAddToPantry, useIngredientSearch, useUnits } from '@/features/pantry/application/pantry-queries';
import { addDays, CUSTOM_UNITS, todayIso, unitsFor, type CustomUnit, type IngredientOption } from '@/features/pantry/domain/pantry';
import { UnderstandPantry } from '@/features/pantry/ui/understand-pantry';
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

/**
 * Agregar a la despensa. Dos caminos: escribirlo como se diría (IA, varias cosas a la vez; ADR-030) o buscar en
 * el catálogo (sin tildes y con errores de tipeo) con cantidad, unidad y vencimiento.
 */
export function AddPantryItemScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useTheme();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<IngredientOption | null>(null);
  // B3b: lo que no está en el catálogo se guarda como alimento propio.
  const [customName, setCustomName] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('');
  const [unitId, setUnitId] = useState<number | null>(null);
  const [expiry, setExpiry] = useState<(typeof EXPIRY_OPTIONS)[number]['key']>('none');
  const [reviewing, setReviewing] = useState(false);
  const results = useIngredientSearch(selected || customName !== null ? '' : query);
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
        {customName !== null ? (
          <CustomItemForm initialName={customName} onCancel={() => setCustomName(null)} onSaved={() => router.back()} />
        ) : !selected ? (
          <>
            <UnderstandPantry onSaved={() => router.back()} onReviewing={setReviewing} />
            {!reviewing && (
              <>
                <AppText variant="label" secondary style={styles.or}>{t('pantry.understand.or')}</AppText>
                <TextField label={t('pantry.search')} icon="search" value={query} onChangeText={setQuery} autoCorrect={false} placeholder={t('pantry.searchPlaceholder')} />
                {results.isError && <Banner tone="danger" message={t(errorKey(results.error))} />}
                {query.trim().length >= 2 && results.data?.length === 0 && <AppText secondary>{t('pantry.noResults')}</AppText>}
                {results.data?.map((ingredient) => (
                  <Pressable
                    key={ingredient.id}
                    accessibilityRole="button"
                    accessibilityLabel={ingredient.name}
                    accessibilityHint={t('pantry.selectHint')}
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
                {query.trim().length >= 2 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('pantry.custom.addAs', { name: query.trim() })}
                    accessibilityHint={t('pantry.custom.note')}
                    onPress={() => setCustomName(query.trim())}
                    style={({ pressed }) => [styles.result, styles.custom, { borderColor: c.border, backgroundColor: pressed ? c.surface : 'transparent' }]}>
                    <Ionicons name="create-outline" size={18} color={c.primary} />
                    <AppText style={styles.flex}>{t('pantry.custom.addAs', { name: query.trim() })}</AppText>
                  </Pressable>
                )}
              </>
            )}
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

/** B3b: formulario de un alimento que no está en el catálogo (nombre, cantidad con su unidad, vencimiento). */
function CustomItemForm({ initialName, onCancel, onSaved }: { initialName: string; onCancel: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const c = useTheme();
  const add = useAddCustomToPantry();
  const [name, setName] = useState(initialName);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<CustomUnit>('unit');
  const [expiry, setExpiry] = useState<(typeof EXPIRY_OPTIONS)[number]['key']>('none');
  const amount = Number(quantity.replace(',', '.'));
  const valid = name.trim().length > 0 && Number.isFinite(amount) && amount > 0 && amount <= 100000;

  const submit = () => {
    const days = EXPIRY_OPTIONS.find((o) => o.key === expiry)?.days ?? null;
    add.mutate(
      { name: name.trim(), quantity: amount, unit, expiresOn: days === null ? null : addDays(todayIso(), days) },
      { onSuccess: onSaved },
    );
  };

  return (
    <>
      <Card variant="primary" style={styles.selected}>
        <IconBadge name="create-outline" tone="accent" />
        <View style={styles.flex}>
          <AppText variant="heading">{t('pantry.custom.title')}</AppText>
          <AppText variant="caption" secondary>{t('pantry.custom.note')}</AppText>
        </View>
        <IconButton icon="search" label={t('pantry.custom.backToSearch')} tone="primary" onPress={onCancel} />
      </Card>
      <TextField label={t('pantry.custom.nameLabel')} icon="pricetag-outline" value={name} onChangeText={setName} maxLength={80} />
      <TextField label={t('pantry.quantity')} icon="scale-outline" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" autoFocus />
      <AppText variant="label">{t('pantry.unit')}</AppText>
      <ChipGroup>
        {CUSTOM_UNITS.map((u) => (
          <Chip key={u} label={t(`pantry.custom.units.${u}`)} selected={u === unit} onPress={() => setUnit(u)} />
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
  custom: { borderStyle: 'dashed' },
  selected: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  or: { textAlign: 'center' },
});
