import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { env } from '@/infrastructure/env';
import { LargeSecureStore } from '@/infrastructure/supabase/secure-storage';
import type { Database } from '@/types/database';

export const supabase = createClient<Database>(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE: los enlaces de correo traen un código que solo puede canjear este dispositivo.
    flowType: 'pkce',
  },
});

// Refrescar el token solo con la app en primer plano.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
