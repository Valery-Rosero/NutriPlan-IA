import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { loadThemePreference, useThemePreference, type ThemePreference } from '@/shared/theme/theme-preference';
import { FormSection, SegmentedControl } from '@/shared/ui';

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
    <FormSection icon="contrast-outline" title={t('profile.appearance.title')} hint={t('profile.appearance.hint')}>
      <SegmentedControl
        label={t('profile.appearance.title')}
        value={preference}
        onChange={choose}
        options={OPTIONS.map((option) => ({ value: option, label: t(`profile.appearance.${option}`) }))}
      />
    </FormSection>
  );
}
