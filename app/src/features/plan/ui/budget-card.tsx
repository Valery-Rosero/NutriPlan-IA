import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { errorKey, toAppError } from '@/core/errors/app-error';
import { formatCOP } from '@/core/format';
import { usePlanBudget } from '@/features/plan/application/plan-queries';
import { budgetLevel } from '@/features/plan/domain/plan';
import { AppText, Banner, Card, LoadingState, TextLink } from '@/shared/ui';

/** US-120, US-127, US-132: costo estimado frente al presupuesto. Los precios faltantes se dicen, no se inventan. */
export function BudgetCard({ planId }: { planId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const budget = usePlanBudget(planId);

  if (budget.isPending) return <LoadingState />;
  if (budget.isError) {
    const needsRegion = toAppError(budget.error).code === 'region_required';
    return (
      <Card>
        <AppText secondary>{t(errorKey(budget.error))}</AppText>
        {needsRegion && (
          <TextLink label={t('plan.budget.setRegion')} onPress={() => router.push({ pathname: '/profile/[section]', params: { section: 'household' } })} />
        )}
      </Card>
    );
  }

  const b = budget.data;
  const level = budgetLevel(b);
  return (
    <Card>
      <AppText variant="subtitle">{t('plan.budget.title')}</AppText>
      <AppText>{t('plan.budget.estimated', { amount: formatCOP(b.estimatedCost) })}</AppText>
      {b.budgetLimit !== null && <AppText secondary>{t('plan.budget.limit', { amount: formatCOP(b.budgetLimit) })}</AppText>}
      {level === 'over' && <Banner tone="danger" message={t('plan.budget.over', { amount: formatCOP(b.overBy ?? 0) })} />}
      {level === 'near' && <Banner tone="warning" message={t('plan.budget.near')} />}
      {b.missingPrices > 0 && <AppText variant="caption" secondary>{t('plan.budget.missing', { count: b.missingPrices })}</AppText>}
      <AppText variant="caption" secondary>{t('plan.budget.source')}</AppText>
    </Card>
  );
}
