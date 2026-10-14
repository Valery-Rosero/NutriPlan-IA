import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { CookingSuggestion } from '@/features/cooking/domain/cooking';
import { Spacing } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';
import { AppText, Card, Pill, ProgressBar } from '@/shared/ui';

/** Una idea de comida: cuánto de lo necesario ya está en la cocina y qué falta. Abre la receta adaptable. */
export function SuggestionCard({ suggestion }: { suggestion: CookingSuggestion }) {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useTheme();
  const coverage = t('cook.coverage', { percent: Math.round(suggestion.coverage * 100) });
  const haveAll = suggestion.missing.length === 0;
  const missing = haveAll
    ? t('cook.haveAll')
    : t('cook.missingList', { list: suggestion.missing.map((m) => m.name).join(', ') });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${suggestion.title}. ${coverage}. ${missing}.`}
      onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: suggestion.recipeId } })}
      style={({ pressed }) => pressed && styles.pressed}>
      <Card>
        <View style={styles.titleRow}>
          <AppText variant="subtitle" style={styles.flex}>{suggestion.title}</AppText>
          <Ionicons name="chevron-forward" size={20} color={c.textSecondary} />
        </View>
        <ProgressBar value={suggestion.coverage} label={coverage} />
        <View style={styles.pills}>
          <Pill label={t('cook.minutes', { count: suggestion.totalMinutes })} icon="time-outline" />
          {haveAll && <Pill label={t('cook.haveAllShort')} tone="primary" icon="checkmark" />}
          {suggestion.usesExpiring && <Pill label={t('cook.usesExpiring')} tone="warning" icon="alert-circle-outline" />}
        </View>
        {!haveAll && <AppText variant="caption" secondary>{missing}</AppText>}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
