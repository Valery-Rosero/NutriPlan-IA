import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { formatGrams } from '@/core/format';
import { useUndoCook } from '@/features/recipes/application/recipe-queries';
import type { CookResult } from '@/features/recipes/domain/recipe';
import { RatingForm } from '@/features/recipes/ui/rating-form';
import { Spacing } from '@/shared/theme/colors';
import { AppText, Banner, Button, Card, Divider, IconBadge } from '@/shared/ui';

const UNDO_SECONDS = 10;

/** Resultado de cocinar (US-123): qué faltó, deshacer durante 10 s y calificar (US-128). */
export function CookResultPanel({ result, onUndone }: { result: CookResult; onUndone: () => void }) {
  const { t } = useTranslation();
  const undo = useUndoCook();
  const [seconds, setSeconds] = useState(UNDO_SECONDS);
  const [rated, setRated] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  return (
    <Card variant="primary">
      <View style={styles.row}>
        <IconBadge name="checkmark-done" tone="accent" size={48} />
        <View style={styles.flex}>
          <AppText variant="heading" accessibilityLiveRegion="polite">{t('recipe.cooked.title')}</AppText>
          <AppText variant="caption" secondary>{t('recipe.cooked.body')}</AppText>
        </View>
      </View>
      {result.shortfall.length > 0 && (
        <>
          <AppText>{t('recipe.cooked.shortfall')}</AppText>
          {result.shortfall.map((s) => (
            <AppText key={s.ingredientId} variant="caption" secondary>{`• ${s.name}: ${formatGrams(s.missingGrams)}`}</AppText>
          ))}
        </>
      )}
      {undo.error && <Banner tone="danger" message={t(errorKey(undo.error))} />}
      {/* Una comida calificada ya no se deshace (la base lo impide): el botón desaparece. */}
      {seconds > 0 && !rated && !undo.isSuccess && (
        <Button
          label={t('recipe.cooked.undo', { seconds })}
          variant="secondary"
          icon="arrow-undo-outline"
          size="sm"
          loading={undo.isPending}
          onPress={() => undo.mutate(result.plannedMealId, { onSuccess: onUndone })}
        />
      )}
      <Divider />
      <RatingForm plannedMealId={result.plannedMealId} onRated={() => setRated(true)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
});
