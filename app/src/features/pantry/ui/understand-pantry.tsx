import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { foodEmoji } from '@/core/food-emoji';
import { formatCOP } from '@/core/format';
import { useSaveUnderstood, useUnderstandPantry, useUnderstandPhoto, useUnits } from '@/features/pantry/application/pantry-queries';
import type { ParsedPantryItem, PhotoKind } from '@/features/pantry/domain/pantry';
import { takePantryPhoto } from '@/features/pantry/ui/take-photo';
import { useRecordPurchase } from '@/features/spending/application/use-spending';
import { Spacing } from '@/shared/theme/colors';
import {
  AppText,
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  ChipGroup,
  DictationHint,
  FoodTile,
  IconBadge,
  Pill,
  SegmentedControl,
  TextField,
} from '@/shared/ui';

type Row = ParsedPantryItem & { include: boolean; quantityText: string };
type Review = { rows: Row[]; from: 'text' | PhotoKind; source: 'ai' | 'rules'; total: number | null };

const toRows = (items: ParsedPantryItem[]): Row[] =>
  // F-3: lo dudoso llega desmarcado.
  items.map((i) => ({ ...i, include: !i.uncertain, quantityText: String(i.quantity).replace('.', ',') }));

/**
 * Agregar a la cocina con IA, por dos caminos que terminan en la misma lista para revisar:
 * - ADR-032 · foto de la nevera o de un recibo (la foto no se guarda);
 * - ADR-030 · "Escríbelo como lo dirías".
 * Nada se guarda hasta revisar y tocar "Guardar". Del recibo, el total se suma al gasto del mes solo si se acepta.
 */
export function UnderstandPantry({ onSaved, onReviewing }: {
  onSaved: () => void;
  /** Mientras se revisa la lista, la pantalla esconde la búsqueda del catálogo. */
  onReviewing?: (reviewing: boolean) => void;
}) {
  const [review, setReviewState] = useState<Review | null>(null);
  const setReview = (next: Review | null) => {
    setReviewState(next);
    onReviewing?.(next !== null);
  };

  if (review) {
    return (
      <ReviewList
        review={review}
        onChange={(rows) => setReviewState({ ...review, rows })}
        onSaved={onSaved}
        onBack={() => setReview(null)}
      />
    );
  }
  return (
    <>
      <PhotoCard onUnderstood={setReview} />
      <TextCard onUnderstood={setReview} />
    </>
  );
}

/** ADR-032: foto de la nevera o del recibo. */
function PhotoCard({ onUnderstood }: { onUnderstood: (review: Review) => void }) {
  const { t } = useTranslation();
  const understand = useUnderstandPhoto();
  const [kind, setKind] = useState<PhotoKind>('fridge');
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState<'camera' | 'library' | null>(null);

  const go = async (source: 'camera' | 'library') => {
    setBusy(source);
    setDenied(false);
    understand.reset();
    try {
      const outcome = await takePantryPhoto(source);
      if (outcome.kind === 'denied') setDenied(true);
      if (outcome.kind !== 'photo') return;
      await understand.mutateAsync(
        { photo: outcome.photo, kind },
        {
          onSuccess: (r) => {
            if (!r.problem) onUnderstood({ rows: toRows(r.items), from: kind, source: 'ai', total: r.total });
          },
        },
      );
    } catch {
      // el error queda en la mutación y se muestra abajo
    } finally {
      setBusy(null);
    }
  };

  const problem = understand.data?.problem;
  return (
    <Card variant="filled">
      <View style={styles.head}>
        <IconBadge name="camera-outline" tone="accent" />
        <View style={styles.flex}>
          <AppText variant="subtitle">{t('pantry.photo.title')}</AppText>
          <AppText variant="caption" secondary>{t('pantry.photo.hint')}</AppText>
        </View>
      </View>
      <SegmentedControl
        label={t('pantry.photo.title')}
        value={kind}
        onChange={setKind}
        flavor="basil"
        options={[
          { value: 'fridge', label: t('pantry.photo.fridge') },
          { value: 'receipt', label: t('pantry.photo.receipt') },
        ]}
      />
      {busy && understand.isPending && <AppText secondary accessibilityLiveRegion="polite">{t('pantry.photo.working')}</AppText>}
      {denied && <Banner tone="warning" message={t('pantry.photo.denied')} />}
      {problem && <Banner tone="warning" message={t(`pantry.photo.problems.${problem}`)} />}
      {understand.error && <Banner tone="danger" message={t(errorKey(understand.error))} />}
      <Button
        label={problem ? t('pantry.photo.retry') : t('pantry.photo.take')}
        icon="camera-outline"
        flavor="basil"
        disabled={!!busy}
        loading={busy === 'camera'}
        onPress={() => void go('camera')}
      />
      <Button
        label={t('pantry.photo.gallery')}
        icon="images-outline"
        variant="outline"
        flavor="basil"
        disabled={!!busy}
        loading={busy === 'library'}
        onPress={() => void go('library')}
      />
      <AppText variant="caption" secondary>{t('pantry.photo.notStored')}</AppText>
    </Card>
  );
}

/** ADR-030: "Escríbelo como lo dirías". */
function TextCard({ onUnderstood }: { onUnderstood: (review: Review) => void }) {
  const { t } = useTranslation();
  const understand = useUnderstandPantry();
  const [text, setText] = useState('');
  const go = () =>
    understand.mutate(text.trim(), {
      onSuccess: (r) => onUnderstood({ rows: toRows(r.items), from: 'text', source: r.source, total: null }),
    });
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
      <DictationHint />
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

function ReviewList({ review, onChange, onSaved, onBack }: {
  review: Review;
  onChange: (rows: Row[]) => void;
  onSaved: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const save = useSaveUnderstood();
  const record = useRecordPurchase();
  // Recibo con total: después de guardar se pregunta si se suma al gasto del mes (decidido: preguntando antes).
  const [askSpend, setAskSpend] = useState(false);
  const { rows } = review;
  const update = (index: number, patch: Partial<Row>) => onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const chosen = rows.filter((r) => r.include);
  const valid = chosen.length > 0 && chosen.every((r) => amount(r.quantityText) > 0);

  if (askSpend && review.total) {
    return (
      <Card>
        <View style={styles.head}>
          <IconBadge name="wallet-outline" tone="mango" />
          <AppText variant="subtitle" style={styles.flex}>{t('pantry.photo.spendQuestion', { amount: formatCOP(review.total) })}</AppText>
        </View>
        {record.error && <Banner tone="danger" message={t(errorKey(record.error))} />}
        <Button
          label={t('pantry.photo.spendYes')}
          icon="checkmark"
          flavor="mango"
          loading={record.isPending}
          onPress={() => record.mutate({ total: review.total! }, { onSuccess: onSaved })}
        />
        <Button label={t('pantry.photo.spendNo')} variant="ghost" onPress={onSaved} />
      </Card>
    );
  }

  return (
    <View style={styles.wrap}>
      <AppText variant="heading" accessibilityRole="header">
        {review.from === 'text' ? t('pantry.understand.reviewTitle') : t('pantry.photo.reviewTitle')}
      </AppText>
      <AppText variant="caption" secondary>{t('pantry.understand.reviewHint')}</AppText>
      {review.source === 'rules' && <Banner tone="warning" message={t('pantry.understand.rules')} />}
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
        onPress={() =>
          save.mutate(chosen.map((r) => ({ ...r, quantity: amount(r.quantityText) })), {
            onSuccess: () => (review.total ? setAskSpend(true) : onSaved()),
          })
        }
      />
      <Button label={t('pantry.understand.again')} variant="ghost" onPress={onBack} />
    </View>
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
          <Checkbox checked={row.include} onChange={(include) => onChange({ include })} label={row.name} flavor="basil" />
        </View>
      </View>
      {row.uncertain && <Pill label={t('pantry.photo.uncertain')} tone="mango" icon="help-circle-outline" />}
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
