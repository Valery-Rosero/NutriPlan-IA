import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useCuisines, useProfile, useSetCuisines, useUpdateProfile } from '@/features/profile/application/profile-queries';
import { COOK_TIME_OPTIONS } from '@/features/profile/domain/profile';
import { Banner, Button, Chip, ChipGroup, ErrorState, FormSection, LoadingState } from '@/shared/ui';

const toggle = (list: number[], id: number) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

/**
 * Tiempo y gustos: tiempo máximo (US-137, restricción: lo que tarda más no se sugiere)
 * y cocinas favoritas (US-138, preferencia blanda: suben en el plan, no excluyen nada).
 */
export function PreferencesForm({ submitLabel, onSaved }: { submitLabel: string; onSaved: () => void }) {
  const { t } = useTranslation();
  const profile = useProfile();
  const cuisines = useCuisines();
  const update = useUpdateProfile();
  const saveCuisines = useSetCuisines();
  // undefined = sin tocar (se muestra lo guardado); null = sin límite.
  const [minutes, setMinutes] = useState<number | null | undefined>(undefined);
  const [cuisineIds, setCuisineIds] = useState<number[] | null>(null);

  if (profile.isPending || cuisines.options.isPending || cuisines.mine.isPending) return <LoadingState />;
  if (cuisines.options.isError || cuisines.mine.isError) {
    return (
      <ErrorState
        message={t(errorKey(cuisines.options.error ?? cuisines.mine.error))}
        onRetry={() => void cuisines.options.refetch()}
      />
    );
  }

  const selectedMinutes = minutes === undefined ? (profile.data?.maxCookMinutes ?? null) : minutes;
  const selectedCuisines = cuisineIds ?? cuisines.mine.data;
  const saving = update.isPending || saveCuisines.isPending;
  const error = update.error ?? saveCuisines.error;

  const save = async () => {
    try {
      await update.mutateAsync({ maxCookMinutes: selectedMinutes });
      await saveCuisines.mutateAsync(selectedCuisines);
      onSaved();
    } catch {
      // el error queda en la mutación y se muestra abajo
    }
  };

  return (
    <>
      <FormSection icon="time-outline" title={t('profile.preferences.timeTitle')} hint={t('profile.preferences.timeHint')}>
        <ChipGroup>
          <Chip label={t('profile.preferences.noLimit')} selected={selectedMinutes === null} onPress={() => setMinutes(null)} />
          {COOK_TIME_OPTIONS.map((option) => (
            <Chip
              key={option}
              label={t('profile.preferences.upTo', { minutes: option })}
              selected={selectedMinutes === option}
              onPress={() => setMinutes(option)}
            />
          ))}
        </ChipGroup>
      </FormSection>

      <FormSection icon="earth-outline" title={t('profile.preferences.cuisinesTitle')} hint={t('profile.preferences.cuisinesHint')}>
        <ChipGroup>
          {cuisines.options.data.map((cuisine) => (
            <Chip
              key={cuisine.id}
              multiple
              label={cuisine.name}
              selected={selectedCuisines.includes(cuisine.id)}
              onPress={() => setCuisineIds(toggle(selectedCuisines, cuisine.id))}
            />
          ))}
        </ChipGroup>
      </FormSection>

      {error && <Banner tone="danger" message={t(errorKey(error))} />}
      <Button label={submitLabel} loading={saving} onPress={() => void save()} />
    </>
  );
}
