import { useTranslation } from 'react-i18next';

import { HealthDisclaimerNote } from '@/features/legal/ui/health-disclaimer-note';
import { AppText, EmptyState, Screen } from '@/shared/ui';

export default function PlanScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <AppText variant="title">{t('plan.title')}</AppText>
      <EmptyState message={t('common.comingSoon')} />
      <HealthDisclaimerNote />
    </Screen>
  );
}
