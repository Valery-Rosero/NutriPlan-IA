import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useKitchenChanged } from '@/features/kitchen/application/kitchen-sync';
import { usePantry, useQuickAdd, useQuickItems, useUndoQuickAdd, type QuickAdded } from '@/features/pantry/application/pantry-queries';
import type { QuickItem } from '@/features/pantry/domain/quick-add';
import { AppText, Banner, Chip, ChipGroup, TextLink } from '@/shared/ui';

/** La cocina se pone al día una vez, cuando la persona deja de tocar (no después de cada toque). */
const SYNC_DELAY_MS = 700;

type Entry = { item: QuickItem; status: 'adding' | 'added' | 'removing'; done?: QuickAdded };

/**
 * "¿Qué hay en tu cocina?": un toque por ingrediente. Se usa en el onboarding, en Hoy y en Mi cocina.
 * M1: lo agregado queda marcado y tocarlo otra vez lo quita (se resta exactamente lo que se sumó).
 * Siempre se ven los 16: lo que ya está en la cocina dice "ya tienes" y un toque suma otra compra típica.
 *
 * Fluido: el toque se marca al instante (sin esperar al servidor), se pueden tocar varios seguidos y los
 * productos no cambian de lugar. Antes cada toque esperaba a la base y a que se recargara toda la cocina, y
 * mientras tanto los demás quedaban bloqueados. Si la base no acepta un toque, se desmarca y se avisa.
 */
export function QuickAdd() {
  const { t } = useTranslation();
  const pantry = usePantry();
  const quickItems = useQuickItems();
  const quickAdd = useQuickAdd();
  const undo = useUndoQuickAdd();
  const kitchenChanged = useKitchenChanged();
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [error, setError] = useState<unknown>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSync = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      syncTimer.current = null;
      void kitchenChanged();
    }, SYNC_DELAY_MS);
  }, [kitchenChanged]);

  // Si la persona sale antes de que pase la espera (p. ej. "Terminar" en el onboarding), la cocina se pone al día igual.
  useEffect(() => {
    const timer = syncTimer;
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void kitchenChanged();
      }
    };
  }, [kitchenChanged]);

  const setEntry = (name: string, entry: Entry | null) =>
    setEntries((prev) => {
      const next = { ...prev };
      if (entry) next[name] = entry;
      else delete next[name];
      return next;
    });

  const toggle = async (item: QuickItem) => {
    const current = entries[item.name];
    if (current && current.status !== 'added') return; // ese mismo ingrediente aún va en camino
    setError(null);
    if (!current) {
      setEntry(item.name, { item, status: 'adding' });
      try {
        const done = await quickAdd.mutateAsync(item);
        setEntry(item.name, { item, status: 'added', done });
        scheduleSync();
      } catch (err) {
        setEntry(item.name, null);
        setError(err);
      }
      return;
    }
    setEntry(item.name, { ...current, status: 'removing' });
    try {
      await undo.mutateAsync(current.done!);
      setEntry(item.name, null);
      scheduleSync();
    } catch (err) {
      setEntry(item.name, current);
      setError(err);
    }
  };

  const have = new Set((pantry.data ?? []).map((i) => i.ingredientId));
  // Primero lo que falta en la cocina; después lo que ya hay (para reponer). Lo que se acaba de tocar no cambia
  // de lugar aunque la cocina ya lo tenga.
  const isHave = (item: QuickItem) => have.has(item.ingredientId) && !entries[item.name];
  const items = [...(quickItems.data ?? [])].sort((a, b) => Number(isHave(a)) - Number(isHave(b)));
  const anyAdded = Object.values(entries).some((e) => e.status !== 'removing');

  return (
    <>
      <AppText secondary>{t('kitchen.quickHint')}</AppText>
      <ChipGroup>
        {items.map((item) => {
          const entry = entries[item.name];
          const selected = !!entry && entry.status !== 'removing';
          return (
            <Chip
              key={item.name}
              label={isHave(item) ? t('kitchen.quickHave', { name: item.name }) : item.name}
              selected={selected}
              multiple
              onPress={() => void toggle(item)}
            />
          );
        })}
      </ChipGroup>
      {quickItems.isError && (
        <>
          <Banner tone="danger" message={t(errorKey(quickItems.error))} />
          <TextLink label={t('common.retry')} icon="refresh" onPress={() => void quickItems.refetch()} />
        </>
      )}
      {anyAdded && <AppText variant="caption" secondary>{t('kitchen.quickUndoHint')}</AppText>}
      {error != null && <Banner tone="danger" message={t(errorKey(error))} />}
    </>
  );
}
