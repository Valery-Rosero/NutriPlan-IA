-- ===================== US-151: reportar un problema o sugerencia (migración 20261110000100) =====================
do $$
declare
  s uuid := '55555555-0000-0000-0000-000000000151';
  o uuid := '55555555-0000-0000-0000-000000000152';
  v_ticket uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  select u, e, jsonb_build_object('privacy_policy_document_id', private.latest_legal_document('privacy_policy'),
                                  'terms_document_id', private.latest_legal_document('terms'), 'is_adult', true)
  from (values (s, 'soporte@test.dev'), (o, 'otra@test.dev')) v(u, e);

  perform tt.login(s);
  insert into public.support_tickets (user_id, category, message, app_version, device_model, screenshot_path)
  values (s, 'bug', 'La lista no carga', '1.0.0', 'Pixel 7', s::text || '/captura.jpg')
  returning id into v_ticket;
  perform tt.ok(v_ticket is not null, 'US-151: se envía un reporte con versión, modelo y captura');

  perform tt.throws(format($q$ insert into public.support_tickets (user_id, category, message) values (%L, 'bug', 'suplantación') $q$, o),
                    'row-level security', 'US-151: no se puede reportar a nombre de otra persona');
  perform tt.throws(format($q$ insert into public.support_tickets (user_id, category, message, screenshot_path)
                              values (%L, 'bug', 'x', %L) $q$, s, o::text || '/ajena.jpg'),
                    'support_tickets_screenshot_own_folder', 'US-151: la captura debe estar en la carpeta propia');
  perform tt.throws(format($q$ insert into public.support_tickets (user_id, category, message) values (%L, 'bug', %L) $q$, s, repeat('a', 501)),
                    'value too long', 'US-151: máximo 500 caracteres');
  perform tt.throws(format($q$ update public.support_tickets set message = 'editado' where id = %L $q$, v_ticket),
                    'permission denied', 'US-151: el reporte no se puede editar');

  -- capturas: solo en la carpeta propia
  insert into storage.objects (bucket_id, name, owner_id) values ('support-screenshots', s::text || '/captura.jpg', s::text);
  perform tt.ok(exists (select 1 from storage.objects where bucket_id = 'support-screenshots' and name = s::text || '/captura.jpg'),
                'US-151: sube la captura a su carpeta');
  perform tt.throws(format($q$ insert into storage.objects (bucket_id, name) values ('support-screenshots', %L) $q$, o::text || '/x.jpg'),
                    'row-level security', 'US-151: no puede subir capturas a la carpeta de otra persona');
  perform tt.reset();

  perform tt.login(o);
  perform tt.ok(not exists (select 1 from public.support_tickets where id = v_ticket), 'US-151: otra persona no ve el reporte');
  perform tt.ok(not exists (select 1 from storage.objects where bucket_id = 'support-screenshots'),
                'US-151: otra persona no ve capturas ajenas');
  perform tt.reset();

  perform tt.ok((select not public from storage.buckets where id = 'support-screenshots'), 'US-151: el bucket de capturas es privado');
end $$;
