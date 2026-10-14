import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { formatCOP } from '@/core/format';
import { useSignOut } from '@/features/auth/application/use-auth';
import { legalHref } from '@/features/legal/ui/legal-href';
import { HealthDisclaimerNote } from '@/features/legal/ui/health-disclaimer-note';
import { AppearanceSection } from '@/features/profile/ui/appearance-section';
import { useProfile, useProfileOptions, useRestrictions } from '@/features/profile/application/profile-queries';
import type { ProfileSection } from '@/features/profile/ui/edit-profile-screen';
import { AppText, Button, Card, Screen, TextLink } from '@/shared/ui';

export function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const signOut = useSignOut();
  const profile = useProfile();
  const restrictions = useRestrictions();
  const { regions, allergens, diets } = useProfileOptions();
  const edit = (section: ProfileSection) => router.push({ pathname: '/profile/[section]', params: { section } });

  const p = profile.data;
  const names = (ids: number[] | undefined, list: { id: number; name: string }[] | undefined) =>
    ids?.length ? ids.map((id) => list?.find((o) => o.id === id)?.name).filter(Boolean).join(', ') : t('profile.none');

  const household = p
    ? t('profile.summary.household', { count: p.householdSize, region: regions.data?.find((r) => r.id === p.regionId)?.name ?? '—' })
    : '…';
  const budget = p?.budgetAmount
    ? t(`profile.summary.budget_${p.budgetPeriod ?? 'week'}`, { amount: formatCOP(p.budgetAmount) })
    : t('profile.summary.noBudget');

  return (
    <Screen scroll>
      <AppText variant="title">{t('profile.title')}</AppText>

      <Section title={t('profile.sections.household')} body={household} onEdit={() => edit('household')} />
      <Section
        title={t('profile.sections.restrictions')}
        body={`${t('profile.summary.allergies')}: ${names(restrictions.data?.allergenIds, allergens.data)}\n${t('profile.summary.diets')}: ${names(restrictions.data?.dietIds, diets.data)}`}
        onEdit={() => edit('restrictions')}
      />
      <Section title={t('profile.sections.budget')} body={budget} onEdit={() => edit('budget')} />
      <AppearanceSection />
      <Section title={t('profile.sections.privacy')} body={t('profile.summary.privacy')} onEdit={() => edit('privacy')} />

      <AppText variant="subtitle">{t('profile.documents')}</AppText>
      <TextLink label={t('legal.kinds.privacy_policy')} onPress={() => router.push(legalHref('privacy_policy'))} />
      <TextLink label={t('legal.kinds.terms')} onPress={() => router.push(legalHref('terms'))} />
      <Button label={t('profile.signOut')} variant="secondary" loading={signOut.isPending} onPress={() => signOut.mutate()} />
      {__DEV__ && <TextLink label="Sistema de diseño (desarrollo)" onPress={() => router.push('/design-system')} />}
      <HealthDisclaimerNote />
    </Screen>
  );
}

function Section({ title, body, onEdit }: { title: string; body: string; onEdit: () => void }) {
  const { t } = useTranslation();
  return (
    <Card>
      <AppText variant="subtitle">{title}</AppText>
      <AppText secondary>{body}</AppText>
      <TextLink label={t('common.edit')} hint={title} onPress={onEdit} />
    </Card>
  );
}
