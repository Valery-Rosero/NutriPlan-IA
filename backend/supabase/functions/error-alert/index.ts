// Edge Function error-alert (US-122, ADR-026). La llama la base cada 5 minutos (pg_cron + pg_net) cuando hay
// fallas nuevas, con un resumen ya limpio (sin datos personales ni de salud). Envía un correo al equipo por Resend.
// Protegida con un secreto compartido (no con JWT: quien llama es la base, no una persona).

type Group = { source: string; error_name: string; message: string; times: number };
type Summary = { total: number; groups: Group[] | null };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false });
  const secret = Deno.env.get('ALERT_SECRET');
  if (!secret || req.headers.get('x-alert-secret') !== secret) return json(401, { ok: false });

  const summary = (await req.json().catch(() => null)) as Summary | null;
  if (!summary || typeof summary.total !== 'number') return json(400, { ok: false });

  const key = Deno.env.get('RESEND_API_KEY');
  const to = Deno.env.get('ALERT_EMAIL');
  if (!key || !to) return json(500, { ok: false, error: 'alert_not_configured' });

  const rows = (summary.groups ?? [])
    .map((g) => `<tr><td>${escape(g.source)}</td><td>${escape(g.error_name)}</td><td>${escape(g.message)}</td><td>${g.times}</td></tr>`)
    .join('');
  const html = `<h2>NutriPlan: ${summary.total} falla(s) nueva(s)</h2>
<table border="1" cellpadding="6" cellspacing="0">
<tr><th>Origen</th><th>Error</th><th>Mensaje</th><th>Veces</th></tr>${rows}</table>
<p>Detalle en Supabase Studio › esquema private › top_errors_7d y errors_by_day.</p>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('ALERT_FROM') ?? 'NutriPlan <onboarding@resend.dev>',
      to: [to],
      subject: `NutriPlan: ${summary.total} falla(s) nueva(s)`,
      html,
    }),
  });
  if (!res.ok) {
    console.error('error-alert: Resend respondió', res.status);
    return json(502, { ok: false });
  }
  return json(200, { ok: true });
});
