import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { usePantry, useQuickAdd, useQuickItems, useUndoQuickAdd, type QuickAdded } from '@/features/pantry/application/pantry-queries';
import type { QuickItem } from '@/features/pantry/domain/quick-add';
import { AppText, Banner, Chip, ChipGroup, TextLink } from '@/shared/ui';

/**
 * "¿Qué hay en tu cocina?": un toque por ingrediente. Se usa en el onboarding, en Hoy y en Mi cocina.
 * M1: lo agregado queda marcado y tocarlo otra vez lo quita (se resta exactamente lo que se sumó).
 * Siempre se ven los 16: lo que ya está en la cocina dice "ya tienes" y un toque suma otra compra típica
 * (antes se escondía y, con la cocina llena, la sección quedaba vacía).
 */
export function QuickAdd() {
  const { t } = useTranslation();
  const pantry = usePantry();
  const quickItems = useQuickItems();
  const quickAdd = useQuickAdd();
  const undo = useUndoQuickAdd();
  const [added, setAdded] = useState<QuickAdded[]>([]);
  const busy = quickAdd.isPending || undo.isPending;

  const addedNames = added.map((a) => a.name);
  const have = new Set((pantry.data ?? []).map((i) => i.ingredientId));
  // Primero lo que falta en la cocina; después lo que ya hay (para reponer).
  const pending = (quickItems.data ?? [])
    .filter((i) => !addedNames.includes(i.name))
    .sort((a, b) => Number(have.has(a.ingredientId)) - Number(have.has(b.ingredientId)));
  const add = (item: QuickItem) => quickAdd.mutate(item, { onSuccess: (done) => setAdded((prev) => [...prev, done]) });
  const remove = (done: QuickAdded) =>
    undo.mutate(done, { onSuccess: () => setAdded((prev) => prev.filter((a) => a.name !== done.name)) });

  return (
    <>
      <AppText secondary>{t('kitchen.quickHint')}</AppText>
      <ChipGroup>
        {added.map((done) => (
          <Chip key={done.name} label={done.name} selected multiple onPress={() => !busy && remove(done)} />
        ))}
        {pending.map((item) => (
          <Chip
            key={item.name}
            label={have.has(item.ingredientId) ? t('kitchen.quickHave', { name: item.name }) : item.name}
            selected={false}
            multiple
            onPress={() => !busy && add(item)}
          />
        ))}
      </ChipGroup>
      {quickItems.isError && (
        <>
          <Banner tone="danger" message={t(errorKey(quickItems.error))} />
          <TextLink label={t('common.retry')} icon="refresh" onPress={() => void quickItems.refetch()} />
        </>
      )}
      {added.length > 0 && <AppText variant="caption" secondary>{t('kitchen.quickUndoHint')}</AppText>}
      {quickAdd.error && <Banner tone="danger" message={t(errorKey(quickAdd.error))} />}
      {undo.error && <Banner tone="danger" message={t(errorKey(undo.error))} />}
    </>
  );
}
