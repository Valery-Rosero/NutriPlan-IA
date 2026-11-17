import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useProfileOptions, useRestrictions, useSetRestrictions } from '@/features/profile/application/profile-queries';
import type { CustomAllergy } from '@/features/profile/domain/profile';
import { CustomAllergiesField } from '@/features/profile/ui/custom-allergies-field';
import { Banner, Button, Chip, ChipGroup, ErrorState, FormSection, LoadingState } from '@/shared/ui';

const toggle = (list: number[], id: number) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

/**
 * US-106 + US-107: alergias y dietas como restricciones DURAS (las aplica la base de datos).
 * US-187: la lista sigue los alérgenos del rotulado en Colombia, con ejemplos, y debajo la persona escribe las suyas.
 */
export function RestrictionsForm({ submitLabel, onSaved }: { submitLabel: string; onSaved: () => void }) {
  const { t } = useTranslation();
  const current = useRestrictions();
  const { allergens, diets } = useProfileOptions();
  const save = useSetRestrictions();
  const [allergenIds, setAllergenIds] = useState<number[] | null>(null);
  const [dietIds, setDietIds] = useState<number[] | null>(null);
  const [custom, setCustom] = useState<CustomAllergy[] | null>(null);

  if (current.isPending || allergens.isPending || diets.isPending) return <LoadingState />;
  if (current.isError || allergens.isError || diets.isError) {
    return <ErrorState message={t(errorKey(current.error ?? allergens.error ?? diets.error))} onRetry={() => void current.refetch()} />;
  }

  const selectedAllergens = allergenIds ?? current.data.allergenIds;
  const selectedDiets = dietIds ?? current.data.dietIds;
  const customAllergies = custom ?? current.data.customAllergies ?? [];
  // "Frutos secos (nueces, almendras…)": el ejemplo ayuda a reconocerla; el perfil muestra solo el nombre.
  const withExamples = (code: string, name: string) => {
    const examples = t(`profile.restrictions.examples.${code}`, { defaultValue: '' });
    return examples ? `${name} (${examples})` : name;
  };

  return (
    <>
      <FormSection
        icon="alert-circle-outline"
        tone="warning"
        title={t('profile.restrictions.allergiesTitle')}
        hint={t('profile.restrictions.allergiesHint')}>
        <ChipGroup>
          {allergens.data.map((a) => (
            <Chip
              key={a.id}
              multiple
              label={withExamples(a.code, a.name)}
              selected={selectedAllergens.includes(a.id)}
              onPress={() => setAllergenIds(toggle(selectedAllergens, a.id))}
            />
          ))}
        </ChipGroup>
        <CustomAllergiesField value={customAllergies} onChange={setCustom} />
      </FormSection>

      <FormSection icon="leaf-outline" title={t('profile.restrictions.dietTitle')} hint={t('profile.restrictions.dietHint')}>
        <ChipGroup>
          {diets.data.map((d) => (
            <Chip
              key={d.id}
              multiple
              label={d.name}
              selected={selectedDiets.includes(d.id)}
              onPress={() => setDietIds(toggle(selectedDiets, d.id))}
            />
          ))}
        </ChipGroup>
      </FormSection>

      <Banner tone="info" message={t('profile.restrictions.safety')} />
      {save.error && <Banner tone="danger" message={t(errorKey(save.error))} />}
      <Button
        label={submitLabel}
        loading={save.isPending}
        onPress={() =>
          save.mutate({ allergenIds: selectedAllergens, dietIds: selectedDiets, customAllergies }, { onSuccess: onSaved })
        }
      />
    </>
  );
}
