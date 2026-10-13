import { useTranslation } from 'react-i18next';

import { AppText, EmptyState, Screen } from '@/components/ui';

export default function PantryScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <AppText variant="title">{t('pantry.title')}</AppText>
      <EmptyState message={t('common.comingSoon')} />
    </Screen>
  );
}
