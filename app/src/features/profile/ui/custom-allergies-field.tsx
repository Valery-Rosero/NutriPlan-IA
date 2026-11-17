import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useIngredientSearch } from '@/features/pantry/application/pantry-queries';
import {
  MAX_CUSTOM_ALLERGIES,
  MAX_CUSTOM_ALLERGY_LENGTH,
  type CustomAllergy,
} from '@/features/profile/domain/profile';
import { Spacing } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';
import { AppText, Banner, Chip, ChipGroup, DictateButton, DictationStatus, TextField } from '@/shared/ui';
import { dictationAvailable, joinDictation, useDictation } from '@/shared/voice/use-dictation';

const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * US-187: "¿Otra alergia? Escríbela". Al escribir salen los ingredientes del recetario que coinciden (sin tildes);
 * tocar uno lo deja como alergia estricta. Si no está en el recetario ("kiwi"), se agrega igual como texto y la IA
 * lo evita. Se puede dictar. La lista completa se guarda con el resto de las restricciones.
 */
export function CustomAllergiesField({ value, onChange }: { value: CustomAllergy[]; onChange: (next: CustomAllergy[]) => void }) {
  const { t } = useTranslation();
  const c = useTheme();
  const [text, setText] = useState('');
  const beforeDictation = useRef('');
  const dictation = useDictation((spoken) => setText(joinDictation(beforeDictation.current, spoken).slice(0, MAX_CUSTOM_ALLERGY_LENGTH)));
  const results = useIngredientSearch(text);

  const full = value.length >= MAX_CUSTOM_ALLERGIES;
  const taken = new Set(value.map((a) => plain(a.label)));
  const typed = text.trim();
  const suggestions = typed.length >= 2 ? (results.data ?? []).filter((i) => !taken.has(plain(i.name))).slice(0, 4) : [];
  const exact = (results.data ?? []).some((i) => plain(i.name) === plain(typed));
  const canAddFree = typed.length >= 2 && !exact && !taken.has(plain(typed));

  const add = (allergy: CustomAllergy) => {
    if (full) return;
    onChange([...value, allergy]);
    setText('');
  };
  const notInCatalog = value.filter((a) => !a.ingredientId).map((a) => a.label);

  return (
    <View style={styles.root}>
      <View style={styles.inputRow}>
        <View style={styles.flex}>
          <TextField
            label={t('profile.restrictions.customLabel')}
            placeholder={t('profile.restrictions.customPlaceholder')}
            value={text}
            onChangeText={(next) => setText(next.slice(0, MAX_CUSTOM_ALLERGY_LENGTH))}
            autoCorrect={false}
            editable={!full}
          />
        </View>
        {dictationAvailable() && (
          <DictateButton
            listening={dictation.listening}
            disabled={full}
            onStart={() => {
              beforeDictation.current = text;
              void dictation.start();
            }}
            onStop={dictation.stop}
          />
        )}
      </View>
      {dictationAvailable() && <DictationStatus listening={dictation.listening} error={dictation.error} />}

      {!full && (suggestions.length > 0 || canAddFree) && (
        <View style={[styles.suggestions, { borderColor: c.divider }]}>
          {suggestions.map((ingredient) => (
            <Pressable
              key={ingredient.id}
              accessibilityRole="button"
              accessibilityLabel={ingredient.name}
              onPress={() => add({ ingredientId: ingredient.id, label: ingredient.name })}
              style={({ pressed }) => [styles.suggestion, { backgroundColor: pressed ? c.surface : c.card }]}>
              <Ionicons name="leaf-outline" size={18} color={c.primary} />
              <AppText style={styles.flex}>{ingredient.name}</AppText>
              <Ionicons name="add-circle-outline" size={22} color={c.textSecondary} />
            </Pressable>
          ))}
          {canAddFree && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('profile.restrictions.customAddFree', { label: typed })}
              onPress={() => add({ ingredientId: null, label: typed })}
              style={({ pressed }) => [styles.suggestion, { backgroundColor: pressed ? c.surface : c.card }]}>
              <Ionicons name="add" size={18} color={c.accent} />
              <AppText style={[styles.flex, { color: c.accent }]}>{t('profile.restrictions.customAddFree', { label: typed })}</AppText>
            </Pressable>
          )}
        </View>
      )}

      {value.length > 0 && (
        <>
          <AppText variant="label">{t('profile.restrictions.customMine')}</AppText>
          <ChipGroup>
            {value.map((allergy) => (
              <Chip
                key={allergy.label}
                label={allergy.label}
                selected
                multiple
                removable
                flavor="basil"
                onPress={() => onChange(value.filter((a) => a.label !== allergy.label))}
              />
            ))}
          </ChipGroup>
        </>
      )}
      {notInCatalog.length > 0 && (
        <Banner tone="warning" message={t('profile.restrictions.customNotInCatalog', { labels: notInCatalog.join('», «') })} />
      )}
      {full && <AppText variant="caption" secondary>{t('profile.restrictions.customMax', { count: MAX_CUSTOM_ALLERGIES })}</AppText>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.sm },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  flex: { flex: 1 },
  suggestions: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 12, minHeight: 48 },
});
