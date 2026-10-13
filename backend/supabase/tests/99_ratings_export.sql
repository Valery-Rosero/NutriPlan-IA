-- ===================== Sprint 6: calificar (US-128, US-134) y exportar datos (US-133) =====================
do $$
declare
  w uuid := '33333333-0000-0000-0000-000000000013';
  v_bowl uuid := (select id from public.recipes where title = 'Bowl de garbanzos y espinaca');
  v_pollo uuid := (select id from public.recipes where title = 'Pollo con arroz y brócoli');
  v_cook jsonb; v_pm uuid; v_plan uuid; v_export jsonb;
begin
  insert into auth.users (id, email, raw_user_meta_data) values (w, 'w@test.dev',
    jsonb_build_object('privacy_policy_document_id', private.latest_legal_document('privacy_policy'),
                       'terms_document_id', private.latest_legal_document('terms'), 'is_adult', true));
  perform tt.login(w);

  v_cook := public.cook_now(v_bowl, 'lunch', 2);
  v_pm := (v_cook ->> 'planned_meal_id')::uuid;
  perform public.rate_meal(v_pm, 5::smallint, array['loved_repeat'], 'Muy rico');
  perform tt.ok((select rating from public.recipe_ratings where planned_meal_id = v_pm) = 5
                and (select count(*) from public.recipe_rating_tag_links) = 1,
                'calificar guarda las estrellas y las etiquetas en una sola operación');
  perform tt.throws(format($q$ select public.rate_meal(%L, 3::smallint) $q$, v_pm), 'already_rated', 'una comida se califica una sola vez');
  perform tt.throws(format($q$ select public.undo_meal_cooked(%L) $q$, v_pm), 'already_rated', 'lo calificado ya no se puede deshacer');

  v_cook := public.cook_now(v_pollo, 'dinner', 2);
  perform public.rate_meal((v_cook ->> 'planned_meal_id')::uuid, 1::smallint, array['bad_taste']);
  perform tt.ok(not exists (select 1 from public.eligible_recipes('dinner') where id = v_pollo),
                'lo calificado con 1 estrella no vuelve a sugerirse (60 días)');

  v_plan := public.generate_plan(current_date + 1, 3, array['lunch']::public.meal_slot[]);
  perform tt.ok(exists (select 1 from public.planned_meals where plan_id = v_plan and recipe_id = v_bowl and reason_code = 'high_rating'),
                'lo que le encantó sube en el plan y se dice por qué');

  v_export := public.export_my_data();
  perform tt.ok(jsonb_array_length(v_export -> 'ratings') = 2 and jsonb_array_length(v_export -> 'meal_plans') >= 1,
                'la exportación incluye calificaciones y planes (portabilidad)');
  perform tt.reset();

  perform tt.login('aaaaaaaa-0000-0000-0000-000000000001');
  perform tt.throws(format($q$ select public.rate_meal(%L, 4::smallint) $q$, v_pm), 'meal_not_found', 'nadie califica comidas ajenas');
  perform tt.reset();
end $$;
