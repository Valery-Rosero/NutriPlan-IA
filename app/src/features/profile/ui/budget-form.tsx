import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { formatCOP } from '@/core/format';
import { useProfile, useUpdateProfile } from '@/features/profile/application/profile-queries';
import { budgetSchema, parseCop, type BudgetPeriod } from '@/features/profile/domain/profile';
import { Banner, Button, FormSection, LoadingState, Pill, SegmentedControl, TextField } from '@/shared/ui';

/** US-108: presupuesto opcional semanal o mensual, en pesos sin decimales. */
export function BudgetForm({ submitLabel, onSaved }: { submitLabel: string; onSaved: () => void }) {
  const { t } = useTranslation();
  const profile = useProfile();
  const update = useUpdateProfile();
  const [amountText, setAmountText] = useState<string | null>(null);
  const [period, setPeriod] = useState<BudgetPeriod | null>(null);

  if (profile.isPending) return <LoadingState />;

  const text = amountText ?? (profile.data?.budgetAmount ? String(Math.round(profile.data.budgetAmount)) : '');
  const amount = parseCop(text);
  const selectedPeriod = period ?? profile.data?.budgetPeriod ?? 'week';
  const parsed = budgetSchema.safeParse({ amount, period: selectedPeriod });

  return (
    <>
      <FormSection icon="wallet-outline" title={t('profile.budget.title')} hint={t('profile.budget.hint')}>
        <SegmentedControl
          label={t('profile.budget.periodLabel')}
          value={selectedPeriod}
          onChange={setPeriod}
          options={[
            { value: 'week', label: t('profile.budget.week') },
            { value: 'month', label: t('profile.budget.month') },
          ]}
        />
        <TextField
          label={t('profile.budget.amount')}
          icon="cash-outline"
          value={text}
          onChangeText={setAmountText}
          keyboardType="number-pad"
          placeholder="150000"
          error={parsed.success ? undefined : parsed.error.issues[0]?.message}
        />
        {amount !== null && (
          <Pill label={t(`profile.summary.budget_${selectedPeriod}`, { amount: formatCOP(amount) })} tone="primary" icon="checkmark" />
        )}
      </FormSection>
      {update.error && <Banner tone="danger" message={t(errorKey(update.error))} />}
      <Button
        label={amount === null ? t('profile.budget.skip') : submitLabel}
        variant={amount === null ? 'secondary' : 'primary'}
        loading={update.isPending}
        disabled={!parsed.success}
        onPress={() => parsed.success && update.mutate(parsed.data, { onSuccess: onSaved })}
      />
    </>
  );
}
