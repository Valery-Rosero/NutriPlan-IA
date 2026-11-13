import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import {
  useCuisines,
  useProfile,
  useSensitiveAuthorization,
  useSetCuisines,
  useUpdateProfile,
} from '@/features/profile/application/profile-queries';
import { COOK_TIME_OPTIONS, kcalTargetSchema, macroSplit, parseCop, PROTEIN_OPTIONS } from '@/features/profile/domain/profile';
import { AppText, Banner, Button, Chip, ChipGroup, ErrorState, FormSection, LoadingState, TextField, TextLink } from '@/shared/ui';

const toggle = (list: number[], id: number) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

/**
 * Tiempo y gustos: tiempo máximo (US-137, restricción: lo que tarda más no se sugiere)
 * y cocinas favoritas (US-138, preferencia blanda: suben en el plan, no excluyen nada).
 * Metas de proteína y kcal (US-136, US-159): datos sensibles, solo con la autorización vigente.
 */
export function PreferencesForm({ submitLabel, onSaved, inOnboarding = false }: {
  submitLabel: string;
  onSaved: () => void;
  /** En el onboarding no hay Perfil › Privacidad a dónde ir: sin autorización, las metas no se muestran. */
  inOnboarding?: boolean;
}) {
  const { t } = useTranslation();
  const profile = useProfile();
  const cuisines = useCuisines();
  const update = useUpdateProfile();
  const saveCuisines = useSetCuisines();
  // undefined = sin tocar (se muestra lo guardado); null = sin límite.
  const [minutes, setMinutes] = useState<number | null | undefined>(undefined);
  const [cuisineIds, setCuisineIds] = useState<number[] | null>(null);
  const sensitive = useSensitiveAuthorization();
  const router = useRouter();
  // Metas (US-136, US-159): undefined = sin tocar; null = sin meta.
  const [protein, setProtein] = useState<number | null | undefined>(undefined);
  const [kcalText, setKcalText] = useState<string | null>(null);

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
  const canSetTargets = sensitive.data === true;
  const selectedProtein = protein === undefined ? (profile.data?.targetProteinPct ?? null) : protein;
  const kcalShown = kcalText ?? (profile.data?.dailyKcalTarget ? String(profile.data.dailyKcalTarget) : '');
  const kcal = kcalTargetSchema.safeParse(parseCop(kcalShown));
  const split = selectedProtein === null ? null : macroSplit(selectedProtein);

  const save = async () => {
    if (canSetTargets && !kcal.success) return;
    try {
      await update.mutateAsync({
        maxCookMinutes: selectedMinutes,
        // Las metas son datos sensibles: solo se envían con la autorización vigente (la base también lo exige).
        ...(canSetTargets && kcal.success ? { targetProteinPct: selectedProtein, dailyKcalTarget: kcal.data } : {}),
      });
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

      {(canSetTargets || !inOnboarding) && (
        <FormSection icon="barbell-outline" title={t('profile.targets.title')} hint={t('profile.targets.hint')}>
          {canSetTargets ? (
            <>
              <AppText variant="label">{t('profile.targets.protein')}</AppText>
              <ChipGroup>
                <Chip label={t('profile.targets.noGoal')} selected={selectedProtein === null} onPress={() => setProtein(null)} />
                {PROTEIN_OPTIONS.map((p) => (
                  <Chip key={p} label={`${p} %`} selected={selectedProtein === p} onPress={() => setProtein(p)} />
                ))}
              </ChipGroup>
              {split && (
                <AppText variant="caption" secondary accessibilityLiveRegion="polite">
                  {t('profile.targets.split', split)}
                </AppText>
              )}
              <TextField
                label={t('profile.targets.kcal')}
                icon="flame-outline"
                value={kcalShown}
                onChangeText={setKcalText}
                keyboardType="number-pad"
                placeholder="2000"
                error={kcal.success ? undefined : kcal.error.issues[0]?.message}
              />
              <AppText variant="caption" secondary>{t('profile.targets.note')}</AppText>
            </>
          ) : (
            <>
              <AppText secondary>{t('profile.targets.needsAuthorization')}</AppText>
              <TextLink
                label={t('profile.targets.authorize')}
                icon="shield-checkmark-outline"
                onPress={() => router.push({ pathname: '/profile/[section]', params: { section: 'privacy' } })}
              />
            </>
          )}
        </FormSection>
      )}

      {error && <Banner tone="danger" message={t(errorKey(error))} />}
      <Button label={submitLabel} loading={saving} onPress={() => void save()} />
    </>
  );
}
