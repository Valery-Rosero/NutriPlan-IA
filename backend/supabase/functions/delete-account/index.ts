// Edge Function delete-account (US-133, contrato en docs/02-arquitectura/edge-functions.md §4).
// Borra la cuenta de quien llama: auth.users en cascada borra todos sus datos personales;
// sus recetas publicadas quedan anónimas (author_id → null). La service_role vive solo aquí.
import { createClient } from 'npm:@supabase/supabase-js@2';

type ErrorCode = 'method_not_allowed' | 'not_authenticated' | 'confirmation_required' | 'unknown';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const fail = (status: number, code: ErrorCode) => json(status, { ok: false, error: { code } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed');

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return fail(401, 'not_authenticated');

  // Confirmación reforzada: la app exige escribir "ELIMINAR".
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || (body as { confirm?: unknown }).confirm !== 'ELIMINAR') {
    return fail(400, 'confirmation_required');
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return fail(401, 'not_authenticated');

  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
  if (deleteError) {
    // Sin datos personales en los logs: solo el estado.
    console.error('delete-account: error al borrar', deleteError.status);
    return fail(500, 'unknown');
  }
  console.info('delete-account: cuenta eliminada');
  return json(200, { ok: true });
});
