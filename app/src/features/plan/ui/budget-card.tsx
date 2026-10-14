import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey, toAppError } from '@/core/errors/app-error';
import { formatCOP } from '@/core/format';
import { usePlanBudget } from '@/features/plan/application/plan-queries';
import { budgetLevel } from '@/features/plan/domain/plan';
import { Spacing } from '@/shared/theme/colors';
import { AppText, Banner, Card, IconBadge, LoadingState, ProgressBar, TextLink } from '@/shared/ui';

/** US-120, US-127, US-132: costo estimado frente al presupuesto. Los precios faltantes se dicen, no se inventan. */
export function BudgetCard({ planId }: { planId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const budget = usePlanBudget(planId);

  if (budget.isPending) return <LoadingState />;
  if (budget.isError) {
    const needsRegion = toAppError(budget.error).code === 'region_required';
    return (
      <Card variant="outlined">
        <View style={styles.row}>
          <IconBadge name="wallet-outline" tone="neutral" />
          <AppText secondary style={styles.flex}>{t(errorKey(budget.error))}</AppText>
        </View>
        {needsRegion && (
          <TextLink
            label={t('plan.budget.setRegion')}
            icon="location-outline"
            onPress={() => router.push({ pathname: '/profile/[section]', params: { section: 'household' } })}
          />
        )}
      </Card>
    );
  }

  const b = budget.data;
  const level = budgetLevel(b);
  return (
    <Card>
      <View style={styles.row}>
        <IconBadge name="wallet-outline" tone={level === 'over' ? 'danger' : level === 'near' ? 'warning' : 'primary'} />
        <View style={styles.flex}>
          <AppText variant="caption" secondary>{t('plan.budget.title')}</AppText>
          <AppText variant="heading" accessibilityLabel={t('plan.budget.estimated', { amount: formatCOP(b.estimatedCost) })}>
            {formatCOP(b.estimatedCost)}
          </AppText>
        </View>
      </View>
      {b.budgetLimit !== null && (
        <>
          <ProgressBar
            value={b.budgetLimit > 0 ? b.estimatedCost / b.budgetLimit : 1}
            tone={level === 'ok' ? 'primary' : 'warning'}
            label={t('plan.budget.limit', { amount: formatCOP(b.budgetLimit) })}
          />
          <AppText variant="caption" secondary>{t('plan.budget.limit', { amount: formatCOP(b.budgetLimit) })}</AppText>
        </>
      )}
      {level === 'over' && <Banner tone="danger" message={t('plan.budget.over', { amount: formatCOP(b.overBy ?? 0) })} />}
      {level === 'near' && <Banner tone="warning" message={t('plan.budget.near')} />}
      {b.missingPrices > 0 && <AppText variant="caption" secondary>{t('plan.budget.missing', { count: b.missingPrices })}</AppText>}
      <AppText variant="caption" secondary>{t('plan.budget.source')}</AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
});
