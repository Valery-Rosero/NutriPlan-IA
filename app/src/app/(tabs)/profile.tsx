import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useSignOut } from '@/features/auth/application/use-auth';
import { HealthDisclaimerNote } from '@/features/legal/ui/health-disclaimer-note';
import { legalHref } from '@/features/legal/ui/legal-href';
import { AppText, Button, Screen, TextLink } from '@/shared/ui';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const signOut = useSignOut();
  return (
    <Screen scroll>
      <AppText variant="title">{t('profile.title')}</AppText>
      <AppText variant="subtitle">{t('profile.documents')}</AppText>
      <TextLink label={t('legal.kinds.privacy_policy')} onPress={() => router.push(legalHref('privacy_policy'))} />
      <TextLink label={t('legal.kinds.terms')} onPress={() => router.push(legalHref('terms'))} />
      <Button label={t('profile.signOut')} variant="secondary" loading={signOut.isPending} onPress={() => signOut.mutate()} />
      <HealthDisclaimerNote />
    </Screen>
  );
}
