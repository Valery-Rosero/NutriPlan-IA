import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { legalHref } from '@/features/legal/ui/legal-href';
import { AppText, TextLink } from '@/shared/ui';

/** Pie fijo de US-114 en Plan y Receta: no es consejo médico. */
export function HealthDisclaimerNote() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <>
      <AppText variant="caption" secondary>{`${t('health.disclaimer')} ${t('health.aiReview')}`}</AppText>
      <TextLink label={t('legal.kinds.health_disclaimer')} onPress={() => router.push(legalHref('health_disclaimer'))} />
    </>
  );
}
