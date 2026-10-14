import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { usePantry } from '@/features/pantry/application/pantry-queries';
import { expiryStatus, todayIso } from '@/features/pantry/domain/pantry';
import { PantryScreen } from '@/features/pantry/ui/pantry-screen';
import { ShoppingScreen } from '@/features/shopping/ui/shopping-screen';
import { Spacing } from '@/shared/theme/colors';
import { BrandHeader, Pill, Screen, SegmentedControl } from '@/shared/ui';

type KitchenTab = 'have' | 'list';

/**
 * Mi cocina (ADR-024): lo que tengo y lo que me falta son la misma cocina vista de dos lados.
 * Lo comprado pasa de la lista a "lo que tengo"; lo cocinado se descuenta de "lo que tengo".
 */
export function KitchenScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  // La sección vive en la ruta (/kitchen?tab=list): así Hoy puede abrir directo la lista de mercado.
  const tab: KitchenTab = useLocalSearchParams<{ tab?: KitchenTab }>().tab ?? 'have';
  const setTab = (next: KitchenTab) => router.setParams({ tab: next });

  const items = usePantry().data ?? [];
  const today = todayIso();
  const expiring = items.filter((i) => expiryStatus(i.expiresOn, today) === 'soon').length;

  return (
    <Screen>
      <BrandHeader
        title={t('kitchen.title')}
        subtitle={t('kitchen.subtitle')}
        action={{ icon: 'person-circle-outline', label: t('profile.title'), onPress: () => router.push('/profile') }}>
        {items.length > 0 && (
          <View style={styles.pills}>
            <Pill label={t('kitchen.count', { count: items.length })} icon="basket-outline" />
            {expiring > 0 && <Pill label={t('kitchen.expiring', { count: expiring })} tone="warning" icon="alert-circle-outline" />}
          </View>
        )}
      </BrandHeader>
      <SegmentedControl
        label={t('kitchen.title')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'have', label: t('kitchen.have') },
          { value: 'list', label: t('kitchen.list') },
        ]}
      />
      {tab === 'have' ? <PantryScreen embedded /> : <ShoppingScreen embedded />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
});
