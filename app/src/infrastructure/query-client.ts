import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager, QueryClient, type Query } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, gcTime: 24 * 60 * 60 * 1000, retry: 1 },
  },
});

// En React Native, TanStack Query no sabe si hay red: se lo dice NetInfo. Sin red, las mutaciones
// (casillas de compras) quedan en pausa y se reanudan solas al volver la conexión.
onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((state) => setOnline(!!state.isConnected)));

export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'nutriplan-cache' });

/**
 * Caché sin conexión (ADR-014): solo se guardan en disco las consultas marcadas con `meta: { persist: true }`
 * (plan y lista de compras). Nada con datos de salud o alergias se persiste sin cifrar.
 */
export function shouldPersistQuery(query: Query) {
  return query.state.status === 'success' && query.meta?.persist === true;
}
