import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatCOP } from '@/core/format';
import { useMonthlySpend } from '@/features/spending/application/use-spending';
import { spendLevel } from '@/features/spending/domain/spending';
import { Spacing } from '@/shared/theme/colors';
import { AppText, Banner, Card, IconBadge, ProgressBar, TextLink } from '@/shared/ui';

/** US-141: "64 % — $38.200 de $60.000" este mes. Pasado el 100 %, la barra y el aviso cambian a alerta. */
export function MonthlySpendCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const spend = useMonthlySpend();

  if (!spend.data) return null; // mientras carga o sin conexión no estorba: es información secundaria
  const s = spend.data;
  const level = spendLevel(s);

  return (
    <Card>
      <View style={styles.row}>
        <IconBadge name="receipt-outline" tone={level === 'over' ? 'danger' : level === 'near' ? 'warning' : 'primary'} />
        <View style={styles.flex}>
          <AppText variant="caption" secondary>{t('spending.title')}</AppText>
          <AppText variant="subtitle">
            {s.monthlyBudget === null
              ? formatCOP(s.spent)
              : t('spending.summary', { percent: s.percent, spent: formatCOP(s.spent), budget: formatCOP(s.monthlyBudget) })}
          </AppText>
        </View>
      </View>
      {s.monthlyBudget !== null && (
        <ProgressBar
          value={s.monthlyBudget > 0 ? s.spent / s.monthlyBudget : 0}
          tone={level === 'ok' ? 'primary' : 'warning'}
          label={t('spending.summary', { percent: s.percent, spent: formatCOP(s.spent), budget: formatCOP(s.monthlyBudget) })}
        />
      )}
      {level === 'over' && <Banner tone="danger" message={t('spending.over')} />}
      <AppText variant="caption" secondary>
        {s.purchases === 0 ? t('spending.noPurchases') : t('spending.purchases', { count: s.purchases })}
      </AppText>
      {s.monthlyBudget === null && (
        <TextLink
          label={t('spending.setBudget')}
          icon="wallet-outline"
          onPress={() => router.push({ pathname: '/profile/[section]', params: { section: 'budget' } })}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
});
