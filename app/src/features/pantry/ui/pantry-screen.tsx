import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, ScrollView, SectionList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { formatGrams } from '@/core/format';
import { usePantry, useRemovePantryItem } from '@/features/pantry/application/pantry-queries';
import { daysBetween, expiryStatus, groupByUrgency, todayIso, type PantryItem } from '@/features/pantry/domain/pantry';
import { QuickAdd } from '@/features/pantry/ui/quick-add';
import { Spacing } from '@/shared/theme/colors';
import {
  AppText,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconBadge,
  IconButton,
  LoadingState,
  Pill,
  Screen,
  TextLink,
  type Tone,
} from '@/shared/ui';

/** US-119 / US-142: lo que hay en casa, agrupado por urgencia (lo que vence primero arriba). */
export function PantryScreen({ embedded }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pantry = usePantry();
  const remove = useRemovePantryItem();
  const add = () => router.push('/pantry/add');
  const Container = embedded ? EmbeddedContainer : Screen;

  const confirmRemove = (item: PantryItem) =>
    Alert.alert(t('pantry.removeTitle', { name: item.name }), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('pantry.remove'), style: 'destructive', onPress: () => remove.mutate(item.id) },
    ]);

  return (
    <Container>
      {!embedded && <AppText variant="title">{t('pantry.title')}</AppText>}
      {remove.error && <Banner tone="danger" message={t(errorKey(remove.error))} />}
      {pantry.isPending ? (
        <LoadingState />
      ) : pantry.isError ? (
        <ErrorState message={t(errorKey(pantry.error))} onRetry={() => void pantry.refetch()} />
      ) : pantry.data.length === 0 ? (
        <ScrollView contentContainerStyle={styles.list}>
          <EmptyState message={t('pantry.empty')} icon="basket-outline" />
          <Card variant="primary">
            <QuickAdd />
          </Card>
          <Button label={t('pantry.add')} icon="add" variant="secondary" onPress={add} />
        </ScrollView>
      ) : (
        <SectionList
          sections={groupByUrgency(pantry.data, todayIso())}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            <View style={styles.header}>
              <Button label={t('pantry.add')} icon="add" onPress={add} />
              <QuickAddCollapsible />
            </View>
          }
          renderSectionHeader={({ section }) => (
            <AppText variant="heading" style={styles.sectionTitle}>
              {t(`pantry.groups.${section.key}`, { count: section.data.length })}
            </AppText>
          )}
          renderItem={({ item }) => <PantryRow item={item} onRemove={() => confirmRemove(item)} />}
        />
      )}
    </Container>
  );
}

function EmbeddedContainer({ children }: { children: ReactNode }) {
  return <View style={styles.embedded}>{children}</View>;
}

/** Con la cocina llena, el agregado rápido queda plegado para no estorbar la lista. */
function QuickAddCollapsible() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.quick}>
      <TextLink
        label={open ? t('kitchen.quickHide') : t('kitchen.quickShow')}
        icon={open ? 'chevron-up' : 'flash-outline'}
        onPress={() => setOpen((o) => !o)}
      />
      {open && (
        <Card variant="filled">
          <QuickAdd />
        </Card>
      )}
    </View>
  );
}

function PantryRow({ item, onRemove }: { item: PantryItem; onRemove: () => void }) {
  const { t } = useTranslation();
  const today = todayIso();
  const status = expiryStatus(item.expiresOn, today);
  // El estado va escrito, no solo en color (accesibilidad).
  const expiry =
    status === 'none'
      ? t('pantry.noExpiry')
      : status === 'expired'
        ? t('pantry.expired')
        : t('pantry.expiresIn', { count: daysBetween(today, item.expiresOn!) });
  const tone: Tone = status === 'expired' ? 'danger' : status === 'soon' ? 'warning' : 'neutral';

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <IconBadge name={status === 'expired' ? 'alert-circle-outline' : 'leaf-outline'} tone={tone === 'neutral' ? 'primary' : tone} />
        {/* La información se lee junta; el botón de quitar queda aparte para que el lector lo alcance. */}
        <View style={styles.info} accessible accessibilityLabel={`${item.name}, ${formatGrams(item.grams)}. ${expiry}.`}>
          <AppText variant="subtitle">{item.name}</AppText>
          <View style={styles.meta}>
            <AppText variant="caption" secondary>{formatGrams(item.grams)}</AppText>
            {status === 'none' ? (
              <AppText variant="caption" secondary>{`· ${expiry}`}</AppText>
            ) : (
              <Pill label={expiry} tone={tone} />
            )}
          </View>
        </View>
        <IconButton icon="trash-outline" label={t('pantry.removeLabel', { name: item.name })} onPress={onRemove} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.sm, paddingBottom: Spacing.lg },
  embedded: { flex: 1, gap: Spacing.md },
  header: { gap: Spacing.sm },
  quick: { gap: Spacing.sm },
  sectionTitle: { marginTop: Spacing.md },
  card: { paddingVertical: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  info: { flex: 1, gap: Spacing.xxs },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm },
});
