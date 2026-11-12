// Registro de fallas de las Edge Functions en public.app_errors (US-122). La base limpia el texto al insertar
// (trigger app_errors_scrub); aquí, además, solo se manda el nombre, un mensaje corto y la función.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export async function reportEdgeError(admin: SupabaseClient, fn: string, error: unknown) {
  try {
    const e = error as { name?: string; message?: string; code?: string };
    await admin.from('app_errors').insert({
      source: 'edge',
      error_name: (e?.code ?? e?.name ?? 'Error').slice(0, 120),
      message: (e?.message ?? String(error)).slice(0, 500),
      screen: fn,
    });
  } catch {
    // Registrar una falla nunca debe causar otra.
  }
}
