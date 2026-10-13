import { useRouter } from 'expo-router';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { formatGrams } from '@/core/format';
import { usePantry, useRemovePantryItem } from '@/features/pantry/application/pantry-queries';
import { daysBetween, expiryStatus, todayIso, type PantryItem } from '@/features/pantry/domain/pantry';
import { Spacing } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';
import { AppText, Banner, Button, Card, EmptyState, ErrorState, LoadingState, Screen, TextLink } from '@/shared/ui';

/** US-119 / US-142: lo que hay en casa, con lo que vence primero arriba. */
export function PantryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const pantry = usePantry();
  const remove = useRemovePantryItem();
  const add = () => router.push('/pantry/add');

  return (
    <Screen>
      <AppText variant="title">{t('pantry.title')}</AppText>
      <Button label={t('pantry.add')} onPress={add} />
      {remove.error && <Banner tone="danger" message={t(errorKey(remove.error))} />}
      {pantry.isPending ? (
        <LoadingState />
      ) : pantry.isError ? (
        <ErrorState message={t(errorKey(pantry.error))} onRetry={() => void pantry.refetch()} />
      ) : pantry.data.length === 0 ? (
        <EmptyState message={t('pantry.empty')} />
      ) : (
        <FlatList
          data={pantry.data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <PantryRow
              item={item}
              onRemove={() =>
                Alert.alert(t('pantry.removeTitle', { name: item.name }), undefined, [
                  { text: t('common.cancel'), style: 'cancel' },
                  { text: t('pantry.remove'), style: 'destructive', onPress: () => remove.mutate(item.id) },
                ])
              }
            />
          )}
        />
      )}
    </Screen>
  );
}

function PantryRow({ item, onRemove }: { item: PantryItem; onRemove: () => void }) {
  const { t } = useTranslation();
  const c = useTheme();
  const today = todayIso();
  const status = expiryStatus(item.expiresOn, today);
  // El estado va escrito, no solo en color (accesibilidad).
  const expiry =
    status === 'none'
      ? t('pantry.noExpiry')
      : status === 'expired'
        ? t('pantry.expired')
        : t('pantry.expiresIn', { count: daysBetween(today, item.expiresOn!) });
  const color = status === 'expired' ? c.danger : status === 'soon' ? c.warning : c.textSecondary;

  return (
    <Card accessibilityLabel={`${item.name}, ${formatGrams(item.grams)}. ${expiry}.`}>
      <View style={styles.row}>
        <View style={styles.info}>
          <AppText variant="subtitle">{item.name}</AppText>
          <AppText secondary>{formatGrams(item.grams)}</AppText>
          <AppText variant="caption" style={{ color }}>{expiry}</AppText>
        </View>
        <TextLink label={t('pantry.remove')} hint={item.name} onPress={onRemove} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.sm, paddingBottom: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  info: { flex: 1, gap: 2 },
});
