import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useRateMeal } from '@/features/recipes/application/recipe-queries';
import { RATING_TAGS, type RatingTag } from '@/features/recipes/domain/recipe';
import { MinTouch } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';
import { AppText, Banner, Button, Chip, ChipGroup, TextField } from '@/shared/ui';

/** US-128: estrellas (cada una anuncia su valor), etiquetas y comentario corto opcional. */
export function RatingForm({ plannedMealId, onRated }: { plannedMealId: string; onRated: () => void }) {
  const { t } = useTranslation();
  const c = useTheme();
  const rate = useRateMeal();
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<RatingTag[]>([]);
  const [comment, setComment] = useState('');

  if (rate.isSuccess) return <Banner tone="success" message={t('recipe.rating.thanks')} />;

  const toggleTag = (tag: RatingTag) => setTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));

  return (
    <>
      <AppText variant="subtitle">{t('recipe.rating.title')}</AppText>
      <View style={styles.stars} accessibilityRole="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityLabel={t('recipe.rating.stars', { count: n })}
            accessibilityState={{ selected: stars === n }}
            onPress={() => setStars(n)}
            style={styles.star}>
            <Ionicons name={n <= stars ? 'star' : 'star-outline'} size={32} color={c.primary} />
          </Pressable>
        ))}
      </View>
      <ChipGroup>
        {RATING_TAGS.map((tag) => (
          <Chip key={tag} multiple label={t(`recipe.rating.tags.${tag}`)} selected={tags.includes(tag)} onPress={() => toggleTag(tag)} />
        ))}
      </ChipGroup>
      <TextField label={t('recipe.rating.comment')} value={comment} onChangeText={(v) => setComment(v.slice(0, 200))} maxLength={200} />
      {rate.error && <Banner tone="danger" message={t(errorKey(rate.error))} />}
      <Button
        label={t('recipe.rating.send')}
        disabled={stars === 0}
        loading={rate.isPending}
        onPress={() => rate.mutate({ plannedMealId, rating: stars, tags, comment }, { onSuccess: onRated })}
      />
    </>
  );
}

const styles = StyleSheet.create({
  stars: { flexDirection: 'row', gap: 4 },
  star: { minWidth: MinTouch, minHeight: MinTouch, alignItems: 'center', justifyContent: 'center' },
});
