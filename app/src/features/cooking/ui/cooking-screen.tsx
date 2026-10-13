import { FlatList, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useCookingSuggestions } from '@/features/cooking/application/use-suggestions';
import type { CookingSuggestion } from '@/features/cooking/domain/cooking';
import { Spacing } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';
import { AppText, Card, EmptyState, ErrorState, LoadingState, Screen } from '@/shared/ui';

export function CookingScreen() {
  const { t } = useTranslation();
  const suggestions = useCookingSuggestions();

  return (
    <Screen>
      <AppText variant="title">{t('cook.title')}</AppText>
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
