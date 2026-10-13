import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useExchangeCode } from '@/features/auth/application/use-auth';

/**
 * Canjea UNA sola vez el código PKCE que trae un enlace de correo (?code=…).
 * Si Supabase devolvió un error en el enlace (?error_code=…), no se intenta el canje.
 */
export function useLinkCode() {
  const params = useLocalSearchParams<{ code?: string; error_code?: string }>();
  const exchange = useExchangeCode();
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !params.code || params.error_code) return;
    started.current = true;
    exchange.mutate(params.code);
  }, [params.code, params.error_code, exchange]);

  const failed = !!params.error_code || !params.code || exchange.isError;
  return { verifying: !failed && !exchange.isSuccess, success: exchange.isSuccess, failed };
}
