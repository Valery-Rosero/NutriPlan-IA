import { useTranslation } from 'react-i18next';

import { AppText, EmptyState, Screen } from '@/shared/ui';

export default function ShoppingScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <AppText variant="title">{t('shopping.title')}</AppText>
      <EmptyState message={t('common.comingSoon')} />
    </Screen>
  );
}
