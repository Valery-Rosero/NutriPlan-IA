import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey, toAppError } from '@/core/errors/app-error';
import { capitalize, formatCOP, formatDay } from '@/core/format';
import { useAcceptSaving, usePlanBudget, useSavings } from '@/features/plan/application/plan-queries';
import { budgetLevel } from '@/features/plan/domain/plan';
import { Spacing } from '@/shared/theme/colors';
import { AppText, Banner, Button, Card, IconBadge, LoadingState, ProgressBar, TextLink } from '@/shared/ui';

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
      {(level === 'over' || level === 'near') && <SavingsPanel planId={planId} />}
      {b.missingPrices > 0 && <AppText variant="caption" secondary>{t('plan.budget.missing', { count: b.missingPrices })}</AppText>}
      <AppText variant="caption" secondary>{t('plan.budget.source')}</AppText>
    </Card>
  );
}

/**
 * US-152: "Ajustar automáticamente" propone cambios concretos con el ahorro exacto. Cada uno se acepta
 * por separado (sugerir, no aplicar sin confirmación) y el total de arriba se recalcula al aceptarlo.
 */
function SavingsPanel({ planId }: { planId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const savings = useSavings(planId, open);
  const accept = useAcceptSaving();

  if (!open) {
    return <Button label={t('plan.savings.open')} icon="trending-down-outline" variant="secondary" size="sm" onPress={() => setOpen(true)} />;
  }
  if (savings.isPending) return <LoadingState />;
  if (savings.isError) return <Banner tone="danger" message={t(errorKey(savings.error))} />;
  if (savings.data.length === 0) return <Banner tone="info" message={t('plan.savings.none')} />;

  return (
    <View style={styles.savings}>
      <AppText variant="label">{t('plan.savings.title')}</AppText>
      {savings.data.map((s) => (
        <View key={s.plannedMealId} style={styles.saving}>
          <View style={styles.flex}>
            <AppText variant="caption" secondary>{`${capitalize(formatDay(s.date))} · ${t(`slots.${s.slot}`)}`}</AppText>
            <AppText>{t('plan.savings.change', { from: s.currentTitle, to: s.alternativeTitle })}</AppText>
            <AppText variant="label" tone="primary">{t('plan.savings.saves', { amount: formatCOP(s.saving) })}</AppText>
          </View>
          <Button
            label={t('plan.savings.accept')}
            size="sm"
            loading={accept.isPending && accept.variables?.plannedMealId === s.plannedMealId}
            onPress={() => accept.mutate(s)}
          />
        </View>
      ))}
      {accept.error && <Banner tone="danger" message={t(errorKey(accept.error))} />}
      <AppText variant="caption" secondary>{t('plan.savings.note')}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1, gap: Spacing.xxs },
  savings: { gap: Spacing.sm },
  saving: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
});
