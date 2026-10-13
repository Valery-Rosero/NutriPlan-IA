import { FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Card, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { useCookWithWhatIHave } from '@/features/cooking/api';
import { useTheme } from '@/hooks/use-theme';
import { errorKey } from '@/lib/errors';

export default function CookScreen() {
  const { t } = useTranslation();
  const c = useTheme();
  const suggestions = useCookWithWhatIHave();

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
          keyExtractor={(item) => item.recipe_id}
          contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
          renderItem={({ item }) => {
            const coverage = t('cook.coverage', { percent: Math.round(item.coverage * 100) });
            const missing = t('cook.missing', { count: item.missing_count });
            return (
              <Card accessibilityLabel={`${item.title}. ${coverage}. ${missing}.`}>
                <AppText variant="subtitle">{item.title}</AppText>
                <AppText secondary>{`${coverage} · ${t('cook.minutes', { count: item.total_minutes })}`}</AppText>
                {item.missing_count > 0 && <AppText variant="caption" secondary>{missing}</AppText>}
                {item.uses_expiring && (
                  <AppText variant="caption" style={{ color: c.warning }}>{t('cook.usesExpiring')}</AppText>
                )}
              </Card>
            );
          }}
        />
      )}
    </Screen>
  );
}
