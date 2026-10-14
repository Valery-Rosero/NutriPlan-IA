import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { BudgetForm } from '@/features/profile/ui/budget-form';
import { HouseholdForm } from '@/features/profile/ui/household-form';
import { PreferencesForm } from '@/features/profile/ui/preferences-form';
import { PrivacySection } from '@/features/profile/ui/privacy-section';
import { RestrictionsForm } from '@/features/profile/ui/restrictions-form';
import { useSensitiveAuthorization } from '@/features/profile/application/profile-queries';
import { Banner, Screen } from '@/shared/ui';

export type ProfileSection = 'household' | 'restrictions' | 'budget' | 'preferences' | 'privacy';

/** US-116: editar el perfil en cualquier momento reutilizando los formularios del onboarding. */
export function EditProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section: ProfileSection }>();
  const sensitive = useSensitiveAuthorization();
  const done = () => router.back();
  const save = t('common.save');

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t(`profile.sections.${section}`) }} />
      <Screen scroll>
        {section === 'household' && <HouseholdForm submitLabel={save} onSaved={done} />}
        {section === 'budget' && <BudgetForm submitLabel={save} onSaved={done} />}
        {section === 'preferences' && <PreferencesForm submitLabel={save} onSaved={done} />}
        {section === 'privacy' && <PrivacySection onDone={done} />}
        {section === 'restrictions' &&
          (sensitive.data === false ? (
            <>
              <Banner tone="warning" message={t('profile.restrictions.needsAuthorization')} />
              <PrivacySection onDone={() => void sensitive.refetch()} />
            </>
          ) : (
            <RestrictionsForm submitLabel={save} onSaved={done} />
          ))}
      </Screen>
    </>
  );
}
