import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { foodEmoji } from '@/core/food-emoji';
import type { CookingSuggestion } from '@/features/cooking/domain/cooking';
import { Spacing } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';
import { AppText, Button, Card, FoodTile, Pill } from '@/shared/ui';

/**
 * Una idea de comida: cuánto de lo necesario ya está en la cocina y qué falta. Abre la receta adaptable.
 * `hero`: la primera idea de Hoy, con el plato grande al frente y un botón para elegirla ("Cocina viva").
 */
export function SuggestionCard({ suggestion, hero = false }: { suggestion: CookingSuggestion; hero?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useTheme();
  const coverage = t('cook.coverage', { percent: Math.round(suggestion.coverage * 100) });
  const haveAll = suggestion.missing.length === 0;
  const missing = haveAll
    ? t('cook.haveAll')
    : t('cook.missingList', { list: suggestion.missing.map((m) => m.name).join(', ') });
  const emoji = foodEmoji(suggestion.title);
  const open = () => router.push({ pathname: '/recipe/[id]', params: { id: suggestion.recipeId } });

  const pills = (
    <View style={styles.pills}>
      <Pill label={t('cook.minutes', { count: suggestion.totalMinutes })} icon="time-outline" />
      <Pill label={haveAll ? t('cook.haveAllShort') : coverage} tone="accent" icon={haveAll ? 'checkmark' : 'basket-outline'} />
      {suggestion.usesExpiring && <Pill label={t('cook.usesExpiring')} tone="mango" icon="alert-circle-outline" />}
    </View>
  );

  if (hero) {
    // Sin Pressable alrededor: el botón es la única acción (un botón dentro de otro confunde al lector).
    return (
      <Card>
        <FoodTile emoji={emoji} size={128} wide />
        <AppText variant="heading">{suggestion.title}</AppText>
        {pills}
        {!haveAll && <AppText variant="caption" secondary>{missing}</AppText>}
        <Button label={t('today.cookThis')} icon="restaurant-outline" hint={t('today.cookThisHint', { title: suggestion.title })} onPress={open} />
      </Card>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${suggestion.title}. ${coverage}. ${missing}.`}
      onPress={open}
      style={({ pressed }) => pressed && styles.pressed}>
      <Card>
        <View style={styles.titleRow}>
          <FoodTile emoji={emoji} size={56} />
          <AppText variant="subtitle" style={styles.flex}>{suggestion.title}</AppText>
          <Ionicons name="chevron-forward" size={20} color={c.textSecondary} />
        </View>
        {pills}
        {!haveAll && <AppText variant="caption" secondary>{missing}</AppText>}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
