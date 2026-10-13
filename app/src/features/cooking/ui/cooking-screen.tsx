import { useRouter } from 'expo-router';
import { FlatList, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useCookingSuggestions } from '@/features/cooking/application/use-suggestions';
import type { CookingSuggestion } from '@/features/cooking/domain/cooking';
import { useRestrictions } from '@/features/profile/application/profile-queries';
import { Spacing } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';
import { AppText, Banner, Card, EmptyState, ErrorState, LoadingState, Screen, TextLink } from '@/shared/ui';

export function CookingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const suggestions = useCookingSuggestions();
  const restrictions = useRestrictions();
  // US-130: sin alergias declaradas no podemos filtrarlas; se dice siempre, no se asume.
  const noAllergies = restrictions.data?.allergenIds.length === 0;

  return (
    <Screen>
      <AppText variant="title">{t('cook.title')}</AppText>
      {noAllergies && (
        <>
          <Banner tone="warning" message={t('cook.noAllergies')} />
          <TextLink
            label={t('cook.declareAllergies')}
            onPress={() => router.push({ pathname: '/profile/[section]', params: { section: 'restrictions' } })}
          />
        </>
      )}
      {suggestions.isPending ? (
        <LoadingState />
      ) : suggestions.isError ? (
        <ErrorState message={t(errorKey(suggestions.error))} onRetry={() => suggestions.refetch()} />
      ) : suggestions.data.length === 0 ? (
        <EmptyState message={t('cook.empty')} />
      ) : (
        <FlatList
          data={suggestions.data}
          keyExtractor={(item) => item.recipeId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <SuggestionCard suggestion={item} />}
        />
      )}
    </Screen>
  );
}

function SuggestionCard({ suggestion }: { suggestion: CookingSuggestion }) {
  const { t } = useTranslation();
  const c = useTheme();
  const coverage = t('cook.coverage', { percent: Math.round(suggestion.coverage * 100) });
  const missing = t('cook.missing', { count: suggestion.missing.length });
  return (
    <Card accessibilityLabel={`${suggestion.title}. ${coverage}. ${missing}.`}>
      <AppText variant="subtitle">{suggestion.title}</AppText>
      <AppText secondary>{`${coverage} · ${t('cook.minutes', { count: suggestion.totalMinutes })}`}</AppText>
      {suggestion.missing.length > 0 && <AppText variant="caption" secondary>{missing}</AppText>}
      {suggestion.usesExpiring && (
        <AppText variant="caption" style={{ color: c.warning }}>{t('cook.usesExpiring')}</AppText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({ list: { gap: Spacing.sm, paddingBottom: Spacing.lg } });
