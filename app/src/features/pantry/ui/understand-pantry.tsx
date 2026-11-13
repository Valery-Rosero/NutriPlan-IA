import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { foodEmoji } from '@/core/food-emoji';
import { useSaveUnderstood, useUnderstandPantry, useUnits } from '@/features/pantry/application/pantry-queries';
import type { ParsedPantryItem } from '@/features/pantry/domain/pantry';
import { Spacing } from '@/shared/theme/colors';
import { AppText, Banner, Button, Card, Checkbox, Chip, ChipGroup, FoodTile, IconBadge, Pill, TextField } from '@/shared/ui';

type Row = ParsedPantryItem & { include: boolean; quantityText: string };

/**
 * ADR-030 · "Escríbelo como lo dirías": la IA separa lo que escribiste ("2 libras de papa criolla y 6 huevos"),
 * lo relaciona con el catálogo y propone cantidad, unidad y vencimiento. Nada se guarda hasta revisar y tocar
 * "Guardar". Si la IA no está, unas reglas simples hacen lo mismo y se avisa.
 */
export function UnderstandPantry({ onSaved, onReviewing }: {
  onSaved: () => void;
  /** Mientras se revisa la lista, la pantalla esconde la búsqueda del catálogo. */
  onReviewing?: (reviewing: boolean) => void;
}) {
  const { t } = useTranslation();
  const understand = useUnderstandPantry();
  const save = useSaveUnderstood();
  const [text, setText] = useState('');
  const [rows, setRowsState] = useState<Row[] | null>(null);
  const setRows = (next: Row[] | null) => {
    setRowsState(next);
    onReviewing?.(next !== null);
  };

  const go = () =>
    understand.mutate(text.trim(), {
      onSuccess: (r) => setRows(r.items.map((i) => ({ ...i, include: true, quantityText: String(i.quantity).replace('.', ',') }))),
    });

  if (rows) {
    const update = (index: number, patch: Partial<Row>) =>
      setRowsState((prev) => prev!.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    const chosen = rows.filter((r) => r.include);
    const valid = chosen.length > 0 && chosen.every((r) => amount(r.quantityText) > 0);
    return (
      <View style={styles.wrap}>
        <AppText variant="heading" accessibilityRole="header">{t('pantry.understand.reviewTitle')}</AppText>
        <AppText variant="caption" secondary>{t('pantry.understand.reviewHint')}</AppText>
        {understand.data?.source === 'rules' && <Banner tone="warning" message={t('pantry.understand.rules')} />}
        {rows.length === 0 && <Banner tone="info" message={t('pantry.understand.nothing')} />}
        {rows.map((row, index) => (
          <ParsedRow key={`${row.ingredientId ?? row.name}-${index}`} row={row} onChange={(patch) => update(index, patch)} />
        ))}
        {save.error && <Banner tone="danger" message={t(errorKey(save.error))} />}
        <Button
          label={t('pantry.understand.save', { count: chosen.length })}
          icon="checkmark"
          flavor="basil"
          disabled={!valid}
          loading={save.isPending}
          onPress={() => save.mutate(chosen.map((r) => ({ ...r, quantity: amount(r.quantityText) })), { onSuccess: onSaved })}
        />
        <Button label={t('pantry.understand.again')} variant="ghost" onPress={() => setRows(null)} />
      </View>
    );
  }

  return (
    <Card variant="filled">
      <View style={styles.head}>
        <IconBadge name="sparkles-outline" tone="berry" />
        <View style={styles.flex}>
          <AppText variant="subtitle">{t('pantry.understand.title')}</AppText>
          <AppText variant="caption" secondary>{t('pantry.understand.hint')}</AppText>
        </View>
      </View>
      <TextField
        label={t('pantry.understand.label')}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={300}
        placeholder="2 libras de papa criolla, 6 huevos y un queso"
      />
      {understand.error && <Banner tone="danger" message={t(errorKey(understand.error))} />}
      <Button
        label={t('pantry.understand.go')}
        icon="sparkles-outline"
        flavor="berry"
        disabled={text.trim().length < 2}
        loading={understand.isPending}
        onPress={go}
      />
    </Card>
  );
}

const amount = (text: string) => {
  const n = Number(text.replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n <= 100000 ? n : 0;
};

function ParsedRow({ row, onChange }: { row: Row; onChange: (patch: Partial<Row>) => void }) {
  const { t } = useTranslation();
  const units = useUnits().data ?? [];
  // Nombre de la unidad: el de la base para el catálogo; el de "alimento propio" para lo demás.
  const unitLabel = (code: string) =>
    row.ingredientId ? units.find((u) => u.code === code)?.name ?? code : t(`pantry.custom.units.${code}`, { defaultValue: code });
  return (
    <Card style={!row.include && styles.off}>
      <View style={styles.head}>
        <FoodTile emoji={foodEmoji(row.name, '🥫')} flavor="basil" size={44} />
        <View style={styles.flex}>
          <Checkbox
            checked={row.include}
            onChange={(include) => onChange({ include })}
            label={row.name}
            flavor="basil"
          />
        </View>
      </View>
      {row.include && (
        <>
          <View style={styles.pills}>
            {!row.ingredientId && <Pill label={t('pantry.understand.own')} icon="create-outline" />}
            <Pill
              label={row.expiresInDays === null ? t('pantry.understand.noExpiry') : t('pantry.understand.expiresIn', { count: row.expiresInDays })}
              icon="time-outline"
              tone={row.expiresInDays !== null && row.expiresInDays <= 3 ? 'mango' : 'neutral'}
            />
          </View>
          <TextField
            label={t('pantry.quantity')}
            icon="scale-outline"
            value={row.quantityText}
            onChangeText={(quantityText) => onChange({ quantityText })}
            keyboardType="decimal-pad"
          />
          <ChipGroup>
            {row.units.map((code) => (
              <Chip key={code} label={unitLabel(code)} selected={row.unit === code} flavor="basil" onPress={() => onChange({ unit: code })} />
            ))}
          </ChipGroup>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  off: { opacity: 0.6 },
});
