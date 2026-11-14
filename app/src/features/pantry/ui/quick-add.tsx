import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { usePantry, useQuickAdd, useUndoQuickAdd, type QuickAdded } from '@/features/pantry/application/pantry-queries';
import { missingQuickItems, type QuickItem } from '@/features/pantry/domain/quick-add';
import { AppText, Banner, Chip, ChipGroup } from '@/shared/ui';

/**
 * "¿Qué hay en tu cocina?": un toque por ingrediente. Se usa en el onboarding, en Hoy y en Mi cocina.
 * M1: lo agregado queda marcado y tocarlo otra vez lo quita (se resta exactamente lo que se sumó).
 */
export function QuickAdd() {
  const { t } = useTranslation();
  const pantry = usePantry();
  const quickAdd = useQuickAdd();
  const undo = useUndoQuickAdd();
  const [added, setAdded] = useState<QuickAdded[]>([]);
  const busy = quickAdd.isPending || undo.isPending;

  const addedNames = added.map((a) => a.name);
  const pending = missingQuickItems((pantry.data ?? []).map((i) => i.name)).filter((i) => !addedNames.includes(i.name));
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
          <Chip key={item.name} label={item.name} selected={false} multiple onPress={() => !busy && add(item)} />
        ))}
      </ChipGroup>
      {added.length > 0 && <AppText variant="caption" secondary>{t('kitchen.quickUndoHint')}</AppText>}
      {quickAdd.error && <Banner tone="danger" message={t(errorKey(quickAdd.error))} />}
      {undo.error && <Banner tone="danger" message={t(errorKey(undo.error))} />}
    </>
  );
}
