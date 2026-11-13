import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, SectionList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { foodEmoji } from '@/core/food-emoji';
import { formatGrams } from '@/core/format';
import { useFoodGroups, usePantry, useRemovePantryItem, useSetCustomGroup } from '@/features/pantry/application/pantry-queries';
import {
  daysBetween,
  expiryStatus,
  FOOD_GROUP_EMOJI,
  FOOD_GROUP_ORDER,
  groupPantry,
  todayIso,
  type FoodGroup,
  type PantryItem,
  type PantrySection,
} from '@/features/pantry/domain/pantry';
import { BuyNextCard } from '@/features/pantry/ui/buy-next-card';
import { QuickAdd } from '@/features/pantry/ui/quick-add';
import { Spacing } from '@/shared/theme/colors';
import {
  AppText,
  Banner,
  Button,
  Card,
  Chip,
  ChipGroup,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FoodTile,
  IconButton,
  LoadingState,
  Pill,
  Screen,
  TextLink,
  type Tone,
} from '@/shared/ui';

/**
 * US-119 / US-142: lo que hay en casa. Arriba lo urgente (vencido, úsalo primero); el resto, por grupo de
 * alimento (ADR-027). En los alimentos propios se ve el grupo que sugirió la IA y se puede cambiar.
 */
export function PantryScreen({ embedded }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pantry = usePantry();
  const groups = useFoodGroups().data ?? [];
  const remove = useRemovePantryItem();
  const add = () => router.push('/pantry/add');
  const Container = embedded ? EmbeddedContainer : Screen;

  const [toRemove, setToRemove] = useState<PantryItem | null>(null);
  const confirmRemove = (item: PantryItem) => setToRemove(item);

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
          <Card variant="filled">
            <QuickAdd />
          </Card>
          <Button label={t('pantry.add')} icon="add" variant="secondary" flavor="basil" onPress={add} />
        </ScrollView>
      ) : (
        <SectionList
          sections={groupPantry(pantry.data, todayIso(), groups)}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            <View style={styles.header}>
              <Button label={t('pantry.add')} icon="add" flavor="basil" onPress={add} />
              <QuickAddCollapsible />
              <BuyNextCard />
            </View>
          }
          renderSectionHeader={({ section }) => (
            <AppText variant="heading" accessibilityRole="header" style={styles.sectionTitle}>
              {sectionTitle(section, t)}
            </AppText>
          )}
          renderItem={({ item }) => <PantryRow item={item} groups={groups} onRemove={() => confirmRemove(item)} />}
        />
      )}
      <ConfirmDialog
        visible={!!toRemove}
        icon="trash-outline"
        title={t('pantry.removeTitle', { name: toRemove?.name ?? '' })}
        confirmLabel={t('pantry.remove')}
        cancelLabel={t('common.cancel')}
        danger
        onConfirm={() => {
          if (toRemove) remove.mutate(toRemove);
          setToRemove(null);
        }}
        onCancel={() => setToRemove(null)}
      />
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

function sectionTitle(section: PantrySection, t: (k: string, o?: Record<string, unknown>) => string) {
  if (section.key === 'expired' || section.key === 'soon') return t(`pantry.groups.${section.key}`, { count: section.data.length });
  const code = section.group?.code ?? 'other';
  return `${FOOD_GROUP_EMOJI[code] ?? FOOD_GROUP_EMOJI.other} ${section.group?.name ?? t('pantry.groups.other')}`;
}

/** Grupos en el mismo orden que la lista, para elegir al corregir. */
const sortGroups = (groups: FoodGroup[]) =>
  [...groups].sort((a, b) => (FOOD_GROUP_ORDER as readonly string[]).indexOf(a.code) - (FOOD_GROUP_ORDER as readonly string[]).indexOf(b.code));

function PantryRow({ item, groups, onRemove }: { item: PantryItem; groups: FoodGroup[]; onRemove: () => void }) {
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
  // "Cocina viva": lo que vence pronto va en mango (úsalo primero), no en rojo; lo vencido sí es un problema.
  const tone: Tone = status === 'expired' ? 'danger' : status === 'soon' ? 'mango' : 'neutral';
  // B3b: un alimento propio muestra su cantidad tal como se escribió (no hay gramos).
  const amount = item.custom
    ? t('pantry.custom.amount', { quantity: item.custom.quantity.toLocaleString('es-CO'), unit: t(`pantry.custom.units.${item.custom.unit}`) })
    : formatGrams(item.grams);

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <FoodTile emoji={foodEmoji(item.name, '🥫')} flavor={status === 'expired' ? 'tomato' : status === 'soon' ? 'mango' : 'basil'} size={48} />
        {/* La información se lee junta; el botón de quitar queda aparte para que el lector lo alcance. */}
        <View style={styles.info} accessible accessibilityLabel={`${item.name}${item.custom ? ` (${t('pantry.custom.badge')})` : ''}, ${amount}. ${expiry}.`}>
          <AppText variant="subtitle">{item.name}</AppText>
          <View style={styles.meta}>
            <AppText variant="caption" secondary>{amount}</AppText>
            {item.custom && <Pill label={t('pantry.custom.badge')} tone="neutral" icon="create-outline" />}
            {status === 'none' ? (
              <AppText variant="caption" secondary>{`· ${expiry}`}</AppText>
            ) : (
              <Pill label={expiry} tone={tone} icon={status === 'expired' ? 'alert-circle-outline' : 'time-outline'} />
            )}
          </View>
        </View>
        <IconButton icon="trash-outline" label={t('pantry.removeLabel', { name: item.name })} onPress={onRemove} />
      </View>
      {item.custom && <SuggestedGroup item={item} groups={groups} />}
    </Card>
  );
}

/** Alimento propio: el grupo que sugirió la IA, a la vista y corregible con un toque. */
function SuggestedGroup({ item, groups }: { item: PantryItem; groups: FoodGroup[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const change = useSetCustomGroup();
  const current = groups.find((g) => g.id === item.foodGroupId);
  return (
    <View style={styles.suggested}>
      <View style={styles.meta}>
        <Pill
          label={current ? t('pantry.ai.group', { group: current.name }) : t('pantry.ai.noGroup')}
          tone="berry"
          icon="sparkles-outline"
        />
        <TextLink
          label={open ? t('common.cancel') : t('pantry.ai.change')}
          hint={t('pantry.ai.changeHint', { name: item.name })}
          onPress={() => setOpen((o) => !o)}
        />
      </View>
      {open && (
        <ChipGroup>
          {sortGroups(groups).map((g) => (
            <Chip
              key={g.id}
              label={`${FOOD_GROUP_EMOJI[g.code] ?? ''} ${g.name}`.trim()}
              selected={g.id === item.foodGroupId}
              flavor="basil"
              onPress={() => change.mutate({ id: item.id, foodGroupId: g.id }, { onSuccess: () => setOpen(false) })}
            />
          ))}
        </ChipGroup>
      )}
      {change.error && <Banner tone="danger" message={t(errorKey(change.error))} />}
    </View>
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
  suggested: { gap: Spacing.sm, marginLeft: 48 + Spacing.md },
});
