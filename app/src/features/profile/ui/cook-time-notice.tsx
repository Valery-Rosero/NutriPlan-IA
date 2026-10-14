import { useTranslation } from 'react-i18next';

import { useProfile, useUpdateProfile } from '@/features/profile/application/profile-queries';
import { nextCookTime } from '@/features/profile/domain/profile';
import { Banner, Button } from '@/shared/ui';

/**
 * US-137, caso borde: si el tiempo máximo deja la lista vacía, se dice por qué y se ofrece
 * ampliar el límite en un toque ("¿probamos con 30?"), en vez de mostrar una lista vacía.
 * No muestra nada si la persona no tiene límite (la causa del vacío es otra).
 */
export function CookTimeNotice() {
  const { t } = useTranslation();
  const profile = useProfile();
  const update = useUpdateProfile();
  const limit = profile.data?.maxCookMinutes ?? null;
  if (limit === null) return null;

  const next = nextCookTime(limit);
  return (
    <>
      <Banner
        tone="info"
        message={next === null ? t('cookTime.noneFoundNoNext', { minutes: limit }) : t('cookTime.noneFound', { minutes: limit, next })}
      />
      <Button
        label={next === null ? t('cookTime.removeLimit') : t('cookTime.tryWith', { minutes: next })}
        icon="time-outline"
        variant="secondary"
        loading={update.isPending}
        onPress={() => update.mutate({ maxCookMinutes: next })}
      />
    </>
  );
}
