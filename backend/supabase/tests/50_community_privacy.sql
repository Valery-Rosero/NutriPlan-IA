-- ===================== Comunidad y moderación =====================
do $$
declare
  a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  b uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  c uuid := 'cccccccc-0000-0000-0000-000000000003';
  d uuid := 'dddddddd-0000-0000-0000-000000000004';
  v_com smallint := private.latest_legal_document('community_sharing');
  v_bowl uuid := (select id from public.recipes where title = 'Bowl de garbanzos y espinaca');
  v_cm uuid; u uuid;
begin
  perform tt.login(a);
  perform tt.throws(format($q$ insert into public.recipe_comments (recipe_id, user_id, body) values (%L, %L, 'Rica') $q$, v_bowl, a),
                    'consent_required', 'comentar exige aceptar compartir en la comunidad');
  perform tt.reset();
  insert into public.user_consents (user_id, document_id) select x, v_com from unnest(array[a,b,c,d]) x;

  perform tt.login(a);
  insert into public.recipe_comments (recipe_id, user_id, body) values (v_bowl, a, 'Rica') returning id into v_cm;
  perform tt.reset();

  perform tt.login(b);
  insert into public.content_reports (reporter_id, comment_id, reason) values (b, v_cm, (enum_range(null::public.report_reason))[1]);
  perform tt.throws(format($q$ insert into public.content_reports (reporter_id, comment_id, reason) values (%L, %L, %L) $q$, b, v_cm, (enum_range(null::public.report_reason))[1]),
                    'duplicate key', 'el mismo usuario no puede reportar dos veces el mismo comentario');
  perform tt.throws(format($q$ insert into public.content_reports (reporter_id, comment_id, recipe_id, reason) values (%L, %L, %L, %L) $q$, b, v_cm, v_bowl, (enum_range(null::public.report_reason))[1]),
                    'check', 'un reporte apunta a un comentario O a una receta, no a ambos');
  perform tt.reset();
  perform tt.ok((select hidden_at is null from public.recipe_comments where id = v_cm), 'con 1 reporte el comentario sigue visible');
  perform tt.login(c);
  insert into public.content_reports (reporter_id, comment_id, reason) values (c, v_cm, (enum_range(null::public.report_reason))[1]);
  perform tt.reset();
  perform tt.login(d);
  insert into public.content_reports (reporter_id, comment_id, reason) values (d, v_cm, (enum_range(null::public.report_reason))[1]);
  perform tt.reset();
  perform tt.ok((select hidden_at is not null from public.recipe_comments where id = v_cm), 'con 3 reportantes distintos el comentario se oculta automáticamente');
end $$;

-- ===================== Calificaciones =====================
do $$
declare
  a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  b uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  v_sopa uuid := (select id from public.recipes where title = 'Sopa de lentejas');
  v_plan uuid := (select id from public.meal_plans where user_id = 'cccccccc-0000-0000-0000-000000000003');
  v_pm uuid := (select id from public.planned_meals where plan_id = v_plan limit 1);
begin
  perform tt.login(b);
  perform tt.throws(format($q$ insert into public.recipe_ratings (user_id, recipe_id, planned_meal_id, rating) values (%L, %L, %L, 5) $q$, b, v_sopa, v_pm),
                    '', 'no se puede calificar una comida que no es tuya');
  insert into public.recipe_ratings (user_id, recipe_id, rating) values (b, v_sopa, 5);
  perform tt.throws(format($q$ insert into public.recipe_ratings (user_id, recipe_id, rating) values (%L, %L, 6) $q$, b, v_sopa), 'check', 'la calificación va de 1 a 5');
  perform tt.reset();
  perform tt.login(a);
  perform tt.ok((select ratings_count from public.recipe_rating_stats where recipe_id = v_sopa) >= 1, 'las estadísticas agregadas son visibles sin exponer calificaciones individuales');
  perform tt.ok((select count(*) from public.recipe_ratings) = 0, 'A no ve las calificaciones individuales de otros');
  perform tt.reset();
end $$;

-- ===================== Analítica anónima y opt-out =====================
do $$
declare
  a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  e public.analytics_event := (enum_range(null::public.analytics_event))[1];
begin
  perform tt.login(a);
  insert into public.analytics_events (anonymous_id, event_type) values (gen_random_uuid(), e);
  perform tt.reset();
  update public.profiles set analytics_enabled = false where id = a;
  perform tt.login(a);
  perform tt.throws(format($q$ insert into public.analytics_events (anonymous_id, event_type) values (gen_random_uuid(), %L) $q$, e),
                    'row-level security', 'con analítica desactivada no se aceptan eventos');
  perform tt.ok((select count(*) from public.analytics_events) = 0, 'los usuarios no pueden leer la analítica');
  perform tt.reset();
  perform tt.ok(not exists (select 1 from information_schema.columns where table_name = 'analytics_events' and column_name = 'user_id'),
                'analytics_events no guarda user_id (analítica anónima por diseño)');
end $$;

-- ===================== Exportar y borrar mis datos =====================
do $$
declare
  a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  c uuid := 'cccccccc-0000-0000-0000-000000000003';
  j jsonb;
begin
  perform tt.login(c);
  j := public.export_my_data();
  perform tt.reset();
  perform tt.ok(j::text like '%' || c::text || '%', 'la exportación incluye los datos del usuario');
  perform tt.ok(j::text not like '%' || a::text || '%', 'la exportación no contiene datos de otro usuario');
  perform tt.throws($q$ select public.export_my_data() $q$, '', 'exportar sin sesión falla') ;
exception when others then
  raise;
end $$;

do $$
declare
  c uuid := 'cccccccc-0000-0000-0000-000000000003';
  n int;
begin
  delete from auth.users where id = c;
  select count(*) into n from (
    select 1 from public.profiles where id = c
    union all select 1 from public.pantry_items where user_id = c
    union all select 1 from public.meal_plans where user_id = c
    union all select 1 from public.shopping_lists where user_id = c
    union all select 1 from public.recipe_ratings where user_id = c
    union all select 1 from public.user_consents where user_id = c
    union all select 1 from public.planned_meals pm where not exists (select 1 from public.meal_plans p where p.id = pm.plan_id)
  ) x;
  perform tt.ok(n = 0, 'borrar la cuenta elimina en cascada todos los datos personales');
  perform tt.ok((select count(*) from public.recipes) >= 7, 'las recetas del catálogo sobreviven al borrado de una cuenta');
end $$;

-- ===================== Consentimientos pendientes =====================
do $$
declare
  b uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  v_old smallint := private.latest_legal_document('privacy_policy');
  v_new smallint;
begin
  insert into public.legal_documents (kind, version) values ('privacy_policy', 2) returning id into v_new;
  perform tt.login(b);
  perform tt.ok(exists (select 1 from public.my_pending_consents where document_id = v_new), 'una nueva versión de la política aparece como consentimiento pendiente');
  perform tt.reset();
  perform tt.throws($q$ insert into auth.users (id, email, raw_user_meta_data)
                        values (gen_random_uuid(), 'late@test.dev', jsonb_build_object('privacy_policy_document_id', $q$ || v_old || $q$, 'terms_document_id', $q$ || private.latest_legal_document('terms') || $q$, 'is_adult', true)) $q$,
                    'consent_required', 'tras publicar la v2, aceptar la v1 ya no basta para registrarse');
end $$;
