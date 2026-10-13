import { useTranslation } from 'react-i18next';

import { AppText, Button, EmptyState, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <AppText variant="title">{t('profile.title')}</AppText>
      <EmptyState message={t('common.comingSoon')} />
      <Button label={t('profile.signOut')} variant="secondary" onPress={() => void supabase.auth.signOut()} />
      <AppText variant="caption" secondary>{t('health.aiReview')}</AppText>
    </Screen>
  );
}
