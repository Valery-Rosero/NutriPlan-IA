import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useProfile, useProfileOptions, useUpdateProfile } from '@/features/profile/application/profile-queries';
import { AppText, Banner, Button, Chip, ChipGroup, ErrorState, LoadingState, Stepper } from '@/shared/ui';

const PILOT_REGION = 'CO-NAR-PASTO';

/** US-109 + región: ciudad (para precios) y cuántas personas comen en casa. */
export function HouseholdForm({ submitLabel, onSaved }: { submitLabel: string; onSaved: () => void }) {
  const { t } = useTranslation();
  const profile = useProfile();
  const { regions } = useProfileOptions();
  const update = useUpdateProfile();
  const [regionId, setRegionId] = useState<number | null>(null);
  const [size, setSize] = useState<number | null>(null);

  if (profile.isPending || regions.isPending) return <LoadingState />;
  if (profile.isError || regions.isError) {
    return <ErrorState message={t(errorKey(profile.error ?? regions.error))} onRetry={() => void profile.refetch()} />;
  }

  const selectedRegion = regionId ?? profile.data.regionId ?? regions.data.find((r) => r.code === PILOT_REGION)?.id ?? null;
  const householdSize = size ?? profile.data.householdSize;

  return (
    <>
      <AppText variant="subtitle">{t('profile.household.title')}</AppText>
      <AppText secondary>{t('profile.household.region')}</AppText>
      <ChipGroup>
        {regions.data.map((region) => (
          <Chip key={region.id} label={region.name} selected={region.id === selectedRegion} onPress={() => setRegionId(region.id)} />
        ))}
      </ChipGroup>
      <Stepper label={t('profile.household.size')} value={householdSize} min={1} max={12} onChange={setSize} />
      <AppText variant="caption" secondary>{t('profile.household.sizeHint')}</AppText>
      {update.error && <Banner tone="danger" message={t(errorKey(update.error))} />}
      <Button
        label={submitLabel}
        disabled={selectedRegion === null}
        loading={update.isPending}
        onPress={() => update.mutate({ regionId: selectedRegion, householdSize }, { onSuccess: onSaved })}
      />
    </>
  );
}
