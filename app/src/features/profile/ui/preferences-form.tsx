import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useProfile, useUpdateProfile } from '@/features/profile/application/profile-queries';
import { COOK_TIME_OPTIONS } from '@/features/profile/domain/profile';
import { Banner, Button, Chip, ChipGroup, FormSection, LoadingState } from '@/shared/ui';

/** Personalización: tiempo máximo de cocina (US-137). Es una restricción: lo que tarda más no se sugiere. */
export function PreferencesForm({ submitLabel, onSaved }: { submitLabel: string; onSaved: () => void }) {
  const { t } = useTranslation();
  const profile = useProfile();
  const update = useUpdateProfile();
  // undefined = sin tocar (se muestra lo guardado); null = sin límite.
  const [minutes, setMinutes] = useState<number | null | undefined>(undefined);

  if (profile.isPending) return <LoadingState />;
  const selected = minutes === undefined ? (profile.data?.maxCookMinutes ?? null) : minutes;

  return (
    <>
      <FormSection icon="time-outline" title={t('profile.preferences.timeTitle')} hint={t('profile.preferences.timeHint')}>
        <ChipGroup>
          <Chip label={t('profile.preferences.noLimit')} selected={selected === null} onPress={() => setMinutes(null)} />
          {COOK_TIME_OPTIONS.map((option) => (
            <Chip
              key={option}
              label={t('profile.preferences.upTo', { minutes: option })}
              selected={selected === option}
              onPress={() => setMinutes(option)}
            />
          ))}
        </ChipGroup>
      </FormSection>
      {update.error && <Banner tone="danger" message={t(errorKey(update.error))} />}
      <Button
        label={submitLabel}
        loading={update.isPending}
        onPress={() => update.mutate({ maxCookMinutes: selected }, { onSuccess: onSaved })}
      />
    </>
  );
}
