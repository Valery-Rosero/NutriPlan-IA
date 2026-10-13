import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { usePantry, useQuickAdd } from '@/features/pantry/application/pantry-queries';
import { missingQuickItems, type QuickItem } from '@/features/pantry/domain/quick-add';
import { AppText, Banner, Chip, ChipGroup } from '@/shared/ui';

/** "¿Qué hay en tu cocina?": un toque por ingrediente. Se usa en el onboarding, en Hoy y en Mi cocina. */
export function QuickAdd() {
  const { t } = useTranslation();
  const pantry = usePantry();
  const quickAdd = useQuickAdd();
  const [added, setAdded] = useState<string[]>([]);

  const pending = missingQuickItems((pantry.data ?? []).map((i) => i.name)).filter((i) => !added.includes(i.name));
  const add = (item: QuickItem) =>
    quickAdd.mutate(item, { onSuccess: () => setAdded((prev) => [...prev, item.name]) });

  return (
    <>
      <AppText secondary>{t('kitchen.quickHint')}</AppText>
      <ChipGroup>
        {added.map((name) => (
          <Chip key={name} label={name} selected multiple onPress={() => undefined} />
        ))}
        {pending.map((item) => (
          <Chip key={item.name} label={item.name} selected={false} multiple onPress={() => add(item)} />
        ))}
      </ChipGroup>
      {quickAdd.error && <Banner tone="danger" message={t(errorKey(quickAdd.error))} />}
    </>
  );
}
