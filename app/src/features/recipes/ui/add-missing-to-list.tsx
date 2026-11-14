import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useCurrentPlan } from '@/features/plan/application/plan-queries';
import { useAddMissingToList, useShoppingList } from '@/features/shopping/application/shopping-queries';
import { Banner, Button } from '@/shared/ui';

/**
 * Lo que falta para una receta, a la lista de mercado de una vez: lo del catálogo con su cantidad (al comprarlo
 * llega a la despensa, ADR-033) y lo libre por nombre (ADR-037). Siempre hay lista: la del plan o la de la casa.
 */
export function AddMissingToList({ items, extras = [] }: { items: { ingredientId: string; grams: number }[]; extras?: string[] }) {
  const { t } = useTranslation();
  const plan = useCurrentPlan();
  const list = useShoppingList(plan.data?.id, plan.isSuccess);
  const add = useAddMissingToList();
  const count = items.length + extras.length;
  if (count === 0) return null;
  if (add.isSuccess) return <Banner tone="success" message={t('recipe.addedMissing')} />;
  if (!plan.isSuccess || list.isPending) return null;
  return (
    <>
      <Button
        label={t('recipe.addMissing', { count })}
        icon="cart-outline"
        variant="secondary"
        flavor="mango"
        size="sm"
        loading={add.isPending}
        onPress={() => add.mutate({ list: list.data, planId: plan.data?.id, items, extras })}
      />
      {add.error && <Banner tone="danger" message={t(errorKey(add.error))} />}
    </>
  );
}
