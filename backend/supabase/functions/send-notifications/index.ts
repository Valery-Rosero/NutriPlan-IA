// Edge Function send-notifications (US-148, US-149, US-153; contrato en docs/02-arquitectura/edge-functions.md §3).
// La llama la base cada 5 minutos (pg_cron + pg_net) con los mensajes ya armados y limpios: aquí solo se
// entregan por Expo Push y se borran los teléfonos que ya no existen (DeviceNotRegistered).
// Protegida con un secreto compartido (no con JWT: quien llama es la base).
import { createClient } from 'npm:@supabase/supabase-js@2';

import { reportEdgeError } from '../_shared/report-error.ts';

type Message = { to: string; title: string; body: string; data: { url: string }; notification_id: number };
type Ticket = { status: 'ok' | 'error'; details?: { error?: string } };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';
const CHUNK = 100; // máximo de Expo por petición

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false });
  const secret = Deno.env.get('PUSH_SECRET');
  if (!secret || req.headers.get('x-push-secret') !== secret) return json(401, { ok: false });

  const payload = (await req.json().catch(() => null)) as { messages?: Message[] } | null;
  const messages = payload?.messages ?? [];
  if (messages.length === 0) return json(200, { ok: true, sent: 0 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let sent = 0;
  const gone: string[] = [];
  try {
    for (let i = 0; i < messages.length; i += CHUNK) {
      const chunk = messages.slice(i, i + CHUNK);
      const res = await fetch(EXPO_PUSH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(
          chunk.map((m) => ({ to: m.to, title: m.title, body: m.body, data: m.data, sound: 'default', channelId: 'default' })),
        ),
      });
      if (!res.ok) throw new Error(`expo_push_http_${res.status}`);
      const tickets = ((await res.json()) as { data: Ticket[] }).data ?? [];
      tickets.forEach((t, k) => {
        if (t.status === 'ok') sent++;
        else if (t.details?.error === 'DeviceNotRegistered') gone.push(chunk[k].to);
      });
    }
    // Teléfonos desinstalados o con el token vencido: no se les vuelve a intentar.
    if (gone.length) await admin.from('push_devices').delete().in('expo_push_token', gone);
    return json(200, { ok: true, sent, removed: gone.length });
  } catch (e) {
    console.error('send-notifications: error', (e as Error).message);
    await reportEdgeError(admin, 'send-notifications', e);
    return json(502, { ok: false });
  }
});
