import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import type { Substitute } from '@/features/recipes/domain/recipe';
import { useSubstituteItem, useUndoSubstitution } from '@/features/shopping/application/shopping-queries';
import type { ShoppingItem } from '@/features/shopping/domain/shopping';
import { Spacing } from '@/shared/theme/colors';
import { AppText, Banner, Checkbox, Chip, ChipGroup, IconButton, TextLink } from '@/shared/ui';

/**
 * Un ítem por comprar. Si tiene sustitutos (US-147), el botón ⇄ los muestra y un toque cambia
 * el ítem en la lista; lo ya sustituido dice "en lugar de …" y se puede deshacer.
 */
export function ShoppingRow({ item, planId, label, substitutes, onToggle, onRemove }: {
  item: ShoppingItem;
  planId: string;
  label: string;
  substitutes: Substitute[] | undefined;
  onToggle: (checked: boolean) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const substitute = useSubstituteItem();
  const undo = useUndoSubstitution();
  const canSwap = !item.checked && item.source === 'plan' && !!substitutes?.length;
  const error = substitute.error ?? undo.error;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Checkbox checked={item.checked} strikeWhenChecked onChange={onToggle} label={label} />
        </View>
        {canSwap && (
          <IconButton
            icon="swap-horizontal"
            tone="primary"
            label={t('shopping.substitute.open', { name: item.name })}
            onPress={() => setOpen((o) => !o)}
          />
        )}
        <IconButton icon="close" label={t('shopping.removeLabel', { name: item.name })} onPress={onRemove} />
      </View>

      {item.replacesName && (
        <View style={styles.replaces}>
          <AppText variant="caption" secondary>{t('shopping.substitute.insteadOf', { name: item.replacesName })}</AppText>
          <TextLink label={t('shopping.substitute.undo')} onPress={() => undo.mutate({ planId, itemId: item.id })} />
        </View>
      )}

      {open && canSwap && (
        <View style={styles.options}>
          <AppText variant="caption" secondary>{t('shopping.substitute.hint', { name: item.name })}</AppText>
          <ChipGroup>
            {substitutes!.map((s) => (
              <Chip
                key={s.substituteId}
                label={s.inPantry ? `${s.name} · ${t('recipe.substitutes.have')}` : s.name}
                selected={false}
                onPress={() =>
                  substitute.mutate({ planId, itemId: item.id, substituteId: s.substituteId }, { onSuccess: () => setOpen(false) })
                }
              />
            ))}
          </ChipGroup>
        </View>
      )}
      {error && <Banner tone="danger" message={t(errorKey(error))} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  flex: { flex: 1 },
  replaces: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginLeft: 36, flexWrap: 'wrap' },
  options: { gap: Spacing.xs, marginLeft: 36 },
});
