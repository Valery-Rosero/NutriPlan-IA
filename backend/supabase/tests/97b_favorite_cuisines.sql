-- ===================== US-138: cocinas favoritas (migración 20261015000100) =====================
do $$
declare
  q uuid := '55555555-0000-0000-0000-000000000038';
  v_med smallint := (select id from public.cuisines where code = 'mediterranean');
  v_int smallint := (select id from public.cuisines where code = 'international');
  v_bowl uuid := (select id from public.recipes where title = 'Bowl de garbanzos y espinaca');
  v_plan uuid; v_without int; v_with int;
begin
  insert into auth.users (id, email, raw_user_meta_data) values (q, 'cocinas@test.dev',
    jsonb_build_object('privacy_policy_document_id', private.latest_legal_document('privacy_policy'),
                       'terms_document_id', private.latest_legal_document('terms'), 'is_adult', true));

  perform tt.login(q);
  -- sin favoritas: línea base
  v_plan := public.generate_plan(current_date, 7, array['lunch', 'dinner']::public.meal_slot[]);
  v_without := (select count(*) from public.planned_meals where plan_id = v_plan and recipe_id = v_bowl);

  -- guardar reemplaza el conjunto completo
  perform public.set_my_cuisines(array[v_med, v_int]);
  perform public.set_my_cuisines(array[v_med]);
  perform tt.ok((select array_agg(cuisine_id) from public.user_cuisines where user_id = q) = array[v_med],
                'US-138: set_my_cuisines reemplaza el conjunto (lo que no viene se borra)');

  v_plan := public.generate_plan(current_date, 7, array['lunch', 'dinner']::public.meal_slot[]);
  v_with := (select count(*) from public.planned_meals where plan_id = v_plan and recipe_id = v_bowl);
  perform tt.ok(v_with >= v_without and v_with > 0,
                format('US-138: la cocina favorita sube en el plan (bowl mediterráneo: %s sin favorita, %s con favorita)', v_without, v_with));
  perform tt.ok(not exists (select 1 from public.planned_meals a join public.planned_meals b
                              on b.plan_id = a.plan_id and b.slot = a.slot and b.meal_date = a.meal_date + 1 and b.recipe_id = a.recipe_id
                            where a.plan_id = v_plan),
                'US-138: la preferencia no rompe la regla de no repetir la misma receta dos días seguidos');

  perform public.set_my_cuisines('{}');
  perform tt.ok(not exists (select 1 from public.user_cuisines where user_id = q), 'US-138: se pueden quitar todas las favoritas');
  perform tt.reset();

  -- sin sesión no se puede
  perform tt.ok(not has_function_privilege('anon', 'public.set_my_cuisines(smallint[])', 'execute'),
                'US-138: anon no puede guardar cocinas favoritas');
end $$;
