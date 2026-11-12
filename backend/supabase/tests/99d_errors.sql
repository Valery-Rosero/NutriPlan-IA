-- ===================== US-122: registro de fallas y alerta (migración 20261112000100) =====================
do $$
declare
  dev uuid := '99999999-0000-4000-8000-000000000122';
  r record;
begin
  -- sin sesión también se puede reportar (un fallo puede ocurrir antes del login)
  perform tt.anon();
  perform public.report_app_error('TypeError',
    'Fallo con ana@correo.com token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc id 3f2a1c4e-1111-4222-8333-444455556666 tel 3001234567',
    'at render (Today.tsx:10)', 'Hoy', '1.0.0', 'Pixel 7', dev);
  perform tt.reset();

  select * into r from public.app_errors where anonymous_id = dev;
  perform tt.ok(r.source = 'app' and r.error_name = 'TypeError' and r.screen = 'Hoy',
                'US-122: la falla se registra con su detalle técnico');
  perform tt.ok(r.message not like '%ana@correo.com%' and r.message like '%[correo]%'
                and r.message not like '%eyJ%' and r.message like '%[token]%'
                and r.message not like '%3f2a1c4e%' and r.message like '%[id]%'
                and r.message not like '%3001234567%',
                'US-122: la base limpia correos, tokens, ids y números del mensaje');

  -- la API no puede leer ni escribir directo
  perform tt.login('aaaaaaaa-0000-0000-0000-000000000001');
  perform tt.ok(not has_table_privilege('authenticated', 'public.app_errors', 'select'), 'US-122: nadie lee las fallas desde la app');
  perform tt.throws($q$ insert into public.app_errors (source, error_name, message) values ('app', 'x', 'y') $q$,
                    'permission denied', 'US-122: no se escribe directo, solo por report_app_error');
  perform tt.reset();

  -- límite por dispositivo: 30 por hora
  for i in 1 .. 40 loop
    perform public.report_app_error('Bucle', 'error repetido', null, null, null, null, dev);
  end loop;
  perform tt.ok((select count(*) from public.app_errors where anonymous_id = dev) = 30,
                'US-122: un dispositivo no puede llenar la tabla (máx. 30 por hora)');

  -- alerta: sin configurar no hace nada; configurada, envía y marca lo avisado
  perform private.dispatch_error_alert();
  perform tt.ok(exists (select 1 from public.app_errors where alerted_at is null), 'US-122: sin configuración, no se avisa ni se marca');
  insert into private.alert_settings (function_url, secret) values ('http://127.0.0.1:9/error-alert', 'prueba');
  perform private.dispatch_error_alert();
  perform tt.ok(not exists (select 1 from public.app_errors where alerted_at is null), 'US-122: al avisar, las fallas quedan marcadas');
  perform tt.ok(exists (select 1 from cron.job where jobname = 'nutriplan-error-alert' and schedule = '*/5 * * * *'),
                'US-122: la revisión corre cada 5 minutos');
  delete from private.alert_settings;

  perform tt.ok((select sum(errors) from private.errors_by_day) = 30, 'US-122: el panel cuenta las fallas por día');
end $$;
