import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { formatCOP } from '@/core/format';
import { useProfile, useUpdateProfile } from '@/features/profile/application/profile-queries';
import { budgetSchema, parseCop, type BudgetPeriod } from '@/features/profile/domain/profile';
import { AppText, Banner, Button, Chip, ChipGroup, LoadingState, TextField } from '@/shared/ui';

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
      <AppText variant="subtitle">{t('profile.budget.title')}</AppText>
      <AppText secondary>{t('profile.budget.hint')}</AppText>
      <ChipGroup>
        <Chip label={t('profile.budget.week')} selected={selectedPeriod === 'week'} onPress={() => setPeriod('week')} />
        <Chip label={t('profile.budget.month')} selected={selectedPeriod === 'month'} onPress={() => setPeriod('month')} />
      </ChipGroup>
      <TextField
        label={t('profile.budget.amount')}
        value={text}
        onChangeText={setAmountText}
        keyboardType="number-pad"
        placeholder="150000"
        error={parsed.success ? undefined : parsed.error.issues[0]?.message}
      />
      {amount !== null && <AppText secondary>{formatCOP(amount)}</AppText>}
      {update.error && <Banner tone="danger" message={t(errorKey(update.error))} />}
      <Button
        label={amount === null ? t('profile.budget.skip') : submitLabel}
        loading={update.isPending}
        disabled={!parsed.success}
        onPress={() => parsed.success && update.mutate(parsed.data, { onSuccess: onSaved })}
      />
    </>
  );
}
