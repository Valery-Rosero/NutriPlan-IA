import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { formatGrams } from '@/core/format';
import { useUndoCook } from '@/features/recipes/application/recipe-queries';
import type { CookResult } from '@/features/recipes/domain/recipe';
import { AppText, Banner, Button, Card } from '@/shared/ui';

const UNDO_SECONDS = 10;

/** Resultado de cocinar (US-123): qué faltó y botón de deshacer durante 10 s. */
export function CookResultPanel({ result, onUndone }: { result: CookResult; onUndone: () => void }) {
  const { t } = useTranslation();
  const undo = useUndoCook();
  const [seconds, setSeconds] = useState(UNDO_SECONDS);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  return (
    <Card>
      <AppText variant="subtitle">{t('recipe.cooked.title')}</AppText>
      <AppText secondary>{t('recipe.cooked.body')}</AppText>
      {result.shortfall.length > 0 && (
        <>
          <AppText>{t('recipe.cooked.shortfall')}</AppText>
          {result.shortfall.map((s) => (
            <AppText key={s.ingredientId} variant="caption" secondary>{`• ${s.name}: ${formatGrams(s.missingGrams)}`}</AppText>
          ))}
        </>
      )}
      {undo.error && <Banner tone="danger" message={t(errorKey(undo.error))} />}
      {seconds > 0 && !undo.isSuccess && (
        <Button
          label={t('recipe.cooked.undo', { seconds })}
          variant="secondary"
          loading={undo.isPending}
          onPress={() => undo.mutate(result.plannedMealId, { onSuccess: onUndone })}
        />
      )}
    </Card>
  );
}
