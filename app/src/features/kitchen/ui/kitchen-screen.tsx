import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PantryScreen } from '@/features/pantry/ui/pantry-screen';
import { ShoppingScreen } from '@/features/shopping/ui/shopping-screen';
import { Chip, ChipGroup, Screen, TabHeader } from '@/shared/ui';

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

  return (
    <Screen>
      <TabHeader
        title={t('kitchen.title')}
        actionIcon="person-circle-outline"
        actionLabel={t('profile.title')}
        onAction={() => router.push('/profile')}
      />
      <ChipGroup>
        <Chip label={t('kitchen.have')} selected={tab === 'have'} onPress={() => setTab('have')} />
        <Chip label={t('kitchen.list')} selected={tab === 'list'} onPress={() => setTab('list')} />
      </ChipGroup>
      {tab === 'have' ? <PantryScreen embedded /> : <ShoppingScreen embedded />}
    </Screen>
  );
}
