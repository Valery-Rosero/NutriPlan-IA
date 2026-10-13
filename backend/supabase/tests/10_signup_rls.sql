-- ===================== Registro y consentimiento =====================
do $$
declare
  v_priv  smallint := private.latest_legal_document('privacy_policy');
  v_terms smallint := private.latest_legal_document('terms');
  v_meta  jsonb := jsonb_build_object('privacy_policy_document_id', v_priv, 'terms_document_id', v_terms, 'is_adult', true);
begin
  perform tt.throws(
    $q$ insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-000000000001','a@test.dev') $q$,
    'consent_required', 'registro sin aceptar la política de privacidad falla');
  perform tt.throws(
    $q$ insert into auth.users (id, email, raw_user_meta_data)
        values ('aaaaaaaa-0000-0000-0000-000000000001','a@test.dev','{"privacy_policy_document_id": 999}') $q$,
    'consent_required', 'registro con una versión que no es la vigente falla');

  perform tt.throws(
    format($q$ insert into auth.users (id, email, raw_user_meta_data) values ('aaaaaaaa-0000-0000-0000-000000000001','a@test.dev', %L) $q$,
           jsonb_build_object('privacy_policy_document_id', v_priv)),
    'consent_required', 'registro sin aceptar los términos vigentes falla');
  perform tt.throws(
    format($q$ insert into auth.users (id, email, raw_user_meta_data) values ('aaaaaaaa-0000-0000-0000-000000000001','a@test.dev', %L) $q$,
           jsonb_build_object('privacy_policy_document_id', v_priv, 'terms_document_id', v_terms)),
    'adult_required', 'registro sin declarar mayoría de edad falla');
  perform tt.throws(
    format($q$ insert into auth.users (id, email, raw_user_meta_data) values ('aaaaaaaa-0000-0000-0000-000000000001','a@test.dev', %L) $q$,
           jsonb_build_object('privacy_policy_document_id', v_priv, 'terms_document_id', v_terms, 'is_adult', false)),
    'adult_required', 'declarar ser menor de edad bloquea el registro');

  insert into auth.users (id, email, raw_user_meta_data) values
    ('aaaaaaaa-0000-0000-0000-000000000001','a@test.dev', v_meta),
    ('bbbbbbbb-0000-0000-0000-000000000002','b@test.dev', v_meta),
    ('cccccccc-0000-0000-0000-000000000003','c@test.dev', v_meta),
    ('dddddddd-0000-0000-0000-000000000004','d@test.dev', v_meta);
  perform tt.ok((select count(*) from public.profiles) = 4, 'el registro crea el perfil');
  perform tt.ok((select count(*) from public.notification_preferences) = 4, 'el registro crea preferencias de notificación');
  perform tt.ok((select count(*) from public.user_consents where document_id in (v_priv, v_terms)) = 8, 'el registro guarda el consentimiento de política y términos');
  perform tt.ok((select count(*) from public.profiles where adult_declared_at is not null) = 4, 'el registro guarda la declaración de mayoría de edad');
end $$;

-- Aviso de salud obligatorio antes de declarar condiciones médicas
do $$
declare v_hd smallint := private.latest_legal_document('health_disclaimer');
begin
  perform tt.throws(
    $q$ insert into public.user_conditions (user_id, condition_id)
        select 'aaaaaaaa-0000-0000-0000-000000000001', id from public.medical_conditions limit 1 $q$,
    'health_disclaimer_required', 'condición médica sin aviso de salud aceptado falla');
  insert into public.user_consents (user_id, document_id) values ('aaaaaaaa-0000-0000-0000-000000000001', v_hd);
  perform tt.throws(
    $q$ insert into public.user_conditions (user_id, condition_id)
        select 'aaaaaaaa-0000-0000-0000-000000000001', id from public.medical_conditions limit 1 $q$,
    'sensitive_authorization_required', 'con aviso de salud pero sin autorización de datos sensibles también falla');
  insert into public.user_consents (user_id, document_id)
    values ('aaaaaaaa-0000-0000-0000-000000000001', private.latest_legal_document('sensitive_data_authorization'));
  insert into public.user_conditions (user_id, condition_id)
    select 'aaaaaaaa-0000-0000-0000-000000000001', id from public.medical_conditions limit 1;
  perform tt.ok(true, 'con aviso de salud y autorización de datos sensibles se permite la condición');
end $$;

-- ===================== RLS =====================
do $$
begin
  perform tt.ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                            where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity),
                'todas las tablas de public tienen RLS activado');
  perform tt.ok((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public' and c.relkind = 'r') >= 55, 'el esquema tiene las tablas esperadas');
end $$;

do $$
declare
  a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  b uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  v_g smallint; v_n int; v_ing uuid;
begin
  select id into v_ing from public.ingredients where name = 'Espinaca';
  select id into v_g from public.units where code = 'g';

  perform tt.login(a);
  perform public.add_to_pantry(v_ing, 100, v_g);
  perform tt.ok((select count(*) from public.pantry_items) = 1, 'A ve su propia despensa');
  perform tt.reset();

  perform tt.login(b);
  perform tt.ok((select count(*) from public.pantry_items) = 0, 'B no ve la despensa de A');
  update public.pantry_items set quantity_g = 1; get diagnostics v_n = row_count;
  perform tt.ok(v_n = 0, 'B no puede modificar filas de A');
  delete from public.pantry_items; get diagnostics v_n = row_count;
  perform tt.ok(v_n = 0, 'B no puede borrar filas de A');
  perform tt.throws(format($q$ insert into public.pantry_items (user_id, ingredient_id, quantity_g) values (%L, %L, 5) $q$, a, v_ing),
                    'row-level security', 'B no puede insertar filas a nombre de A');
  perform tt.ok((select count(*) from public.profiles) = 1, 'B solo ve su propio perfil');
  perform tt.throws($q$ insert into public.ingredients (name, food_group_id, store_category_id) values ('Hack', 1, 1) $q$,
                    'permission denied', 'los catálogos son de solo lectura para usuarios');
  perform tt.throws($q$ insert into public.notifications (user_id, kind) values ('bbbbbbbb-0000-0000-0000-000000000002','weekly_summary') $q$,
                    'denied', 'un usuario no puede escribir notificaciones');
  perform tt.throws($q$ update public.user_consents set accepted_at = now() $q$,
                    'denied', 'los consentimientos son inmutables');
  perform tt.reset();

  perform tt.anon();
  perform tt.ok((select count(*) from public.legal_documents) >= 4, 'anon puede leer los documentos legales');
  perform tt.throws($q$ select * from public.recipes $q$, 'permission denied', 'anon no puede leer recetas');
  perform tt.throws($q$ select * from public.profiles $q$, 'permission denied', 'anon no puede leer perfiles');
  perform tt.reset();
end $$;
