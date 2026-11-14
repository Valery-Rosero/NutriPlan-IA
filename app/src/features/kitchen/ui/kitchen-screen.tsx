import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { usePantry } from '@/features/pantry/application/pantry-queries';
import { expiryStatus, mergeLots, todayIso } from '@/features/pantry/domain/pantry';
import { PantryScreen } from '@/features/pantry/ui/pantry-screen';
import { ShoppingScreen } from '@/features/shopping/ui/shopping-screen';
import { Spacing } from '@/shared/theme/colors';
import { BrandHeader, Pill, Screen, SegmentedControl } from '@/shared/ui';

type KitchenTab = 'have' | 'list';

/**
 * Mi cocina (ADR-024): lo que tengo y lo que me falta son la misma cocina vista de dos lados.
 * A3 (ADR-036): el encabezado es de una fila y se desplaza con el contenido, para que quepa la lista.
 */
export function KitchenScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  // La sección vive en la ruta (/kitchen?tab=list): así Hoy puede abrir directo la lista de mercado.
  const tab: KitchenTab = useLocalSearchParams<{ tab?: KitchenTab }>().tab ?? 'have';
  const setTab = (next: KitchenTab) => router.setParams({ tab: next });

  const today = todayIso();
  // Una fila por alimento (A6), igual que en la lista.
  const items = mergeLots(usePantry().data ?? [], today);
  const expiring = items.filter((i) => expiryStatus(i.expiresOn, today) === 'soon').length;

  const header = (
    <View style={styles.header}>
      <BrandHeader
        compact
        title={t('kitchen.title')}
        flavor="basil"
        action={{ icon: 'person-circle-outline', label: t('profile.title'), onPress: () => router.push('/profile') }}>
        {items.length > 0 && (
          <View style={styles.pills}>
            <Pill label={t('kitchen.count', { count: items.length })} tone="accent" icon="leaf-outline" />
            {expiring > 0 && <Pill label={t('kitchen.expiring', { count: expiring })} tone="mango" icon="alert-circle-outline" />}
          </View>
        )}
      </BrandHeader>
      <SegmentedControl
        label={t('kitchen.title')}
        flavor="basil"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'have', label: t('kitchen.have') },
          { value: 'list', label: t('kitchen.list') },
        ]}
      />
    </View>
  );

  return <Screen>{tab === 'have' ? <PantryScreen header={header} /> : <ShoppingScreen header={header} />}</Screen>;
}

const styles = StyleSheet.create({
  header: { gap: Spacing.sm, paddingBottom: Spacing.xs },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
