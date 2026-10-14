import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { loadThemePreference, useThemePreference, type ThemePreference } from '@/shared/theme/theme-preference';
import { AppText, Card, Chip, ChipGroup } from '@/shared/ui';

const OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];

/** Apariencia: seguir al teléfono o fijar claro/oscuro. */
export function AppearanceSection() {
  const { t } = useTranslation();
  const { preference, choose, setPreference } = useThemePreference();

  useEffect(() => {
    let active = true;
    void loadThemePreference().then((saved) => active && setPreference(saved));
    return () => {
      active = false;
    };
  }, [setPreference]);

  return (
    <Card>
      <AppText variant="subtitle">{t('profile.appearance.title')}</AppText>
      <ChipGroup>
        {OPTIONS.map((option) => (
          <Chip key={option} label={t(`profile.appearance.${option}`)} selected={preference === option} onPress={() => choose(option)} />
        ))}
      </ChipGroup>
    </Card>
  );
}
