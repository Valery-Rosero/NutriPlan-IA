import { useTranslation } from 'react-i18next';

import { AppText, EmptyState, Screen } from '@/components/ui';

export default function PlanScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <AppText variant="title">{t('plan.title')}</AppText>
      <EmptyState message={t('common.comingSoon')} />
    </Screen>
  );
}
