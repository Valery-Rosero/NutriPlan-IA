import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { CookingSuggestion } from '@/features/cooking/domain/cooking';
import { useTheme } from '@/shared/theme/use-theme';
import { AppText, Card } from '@/shared/ui';

/** Una idea de comida: cuánto de lo necesario ya está en la cocina y qué falta. Abre la receta adaptable. */
export function SuggestionCard({ suggestion }: { suggestion: CookingSuggestion }) {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useTheme();
  const coverage = t('cook.coverage', { percent: Math.round(suggestion.coverage * 100) });
  const missing = suggestion.missing.length
    ? t('cook.missingList', { list: suggestion.missing.map((m) => m.name).join(', ') })
    : t('cook.haveAll');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${suggestion.title}. ${coverage}. ${missing}.`}
      onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: suggestion.recipeId } })}>
      <Card>
        <AppText variant="subtitle">{suggestion.title}</AppText>
        <AppText secondary>{`${coverage} · ${t('cook.minutes', { count: suggestion.totalMinutes })}`}</AppText>
        <AppText variant="caption" secondary>{missing}</AppText>
        {suggestion.usesExpiring && (
          <AppText variant="caption" style={{ color: c.warning }}>{t('cook.usesExpiring')}</AppText>
        )}
      </Card>
    </Pressable>
  );
}
