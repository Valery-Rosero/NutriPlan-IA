import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { useServices } from '@/di/services';
import type { AuthSession } from '@/features/auth/domain/auth-repository';

type SessionState = { session: AuthSession | null; loading: boolean };

const SessionContext = createContext<SessionState>({ session: null, loading: true });

/** Observa los cambios de sesión del repositorio y los publica a toda la app. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const { auth } = useServices();
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>({ session: null, loading: true });
  const currentUserId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const publish = (session: AuthSession | null) => {
      const userId = session?.userId ?? null;
      // Al cerrar sesión o cambiar de cuenta no debe quedar en caché nada de la anterior.
      if (currentUserId.current !== null && currentUserId.current !== userId) queryClient.clear();
      currentUserId.current = userId;
      if (active) setState({ session, loading: false });
    };

    auth.getSession().then(publish, () => publish(null));
    const unsubscribe = auth.onSessionChange(publish);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [auth, queryClient]);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
