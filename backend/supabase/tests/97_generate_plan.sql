-- ===================== Sprint 4: generador de plan (migración 20261014000300) =====================
do $$
declare
  p uuid := '55555555-0000-0000-0000-000000000011';
  v_plan uuid; v_plan2 uuid; v_today_plan uuid; v_cook jsonb;
  v_bowl uuid := (select id from public.recipes where title = 'Bowl de garbanzos y espinaca');
  v_g smallint := (select id from public.units where code = 'g');
begin
  insert into auth.users (id, email, raw_user_meta_data) values (p, 'p@test.dev',
    jsonb_build_object('privacy_policy_document_id', private.latest_legal_document('privacy_policy'),
                       'terms_document_id', private.latest_legal_document('terms'), 'is_adult', true));
  perform tt.login(p);
  perform public.add_to_pantry((select id from public.ingredients where name = 'Espinaca'), 300, v_g, current_date + 1);

  -- "Cocinar ahora" hoy crea un borrador de un día con una comida cocinada
  v_cook := public.cook_now(v_bowl, 'lunch', 2);
  v_today_plan := (select plan_id from public.planned_meals where id = (v_cook ->> 'planned_meal_id')::uuid);

  v_plan := public.generate_plan(current_date, 7);
  perform tt.ok((select count(*) from public.planned_meals where plan_id = v_plan) = 20,
                'plan de 7 días × 3 comidas, sin volver a planear el almuerzo de hoy que ya se cocinó');
  perform tt.ok((select status from public.meal_plans where id = v_today_plan) = 'archived',
                'el borrador con una comida cocinada se archiva, no se borra (historial)');
  perform tt.ok(exists (select 1 from public.planned_meals where plan_id = v_plan and reason_code = 'pantry_expiring'),
                'prioriza lo que vence pronto (espinaca) y lo dice en el motivo');
  perform tt.ok(not exists (
                  select 1 from public.planned_meals a join public.planned_meals b
                    on b.plan_id = a.plan_id and b.slot = a.slot and b.meal_date = a.meal_date + 1 and b.recipe_id = a.recipe_id
                  where a.plan_id = v_plan),
                'no repite la misma receta en el mismo momento dos días seguidos');

  v_plan2 := public.generate_plan(current_date, 7);
  perform tt.ok((select count(*) from public.meal_plans where user_id = p and status = 'draft') = 1
                and not exists (select 1 from public.meal_plans where id = v_plan),
                'volver a generar reemplaza el borrador anterior');

  v_plan := public.generate_plan(current_date, 1, array['breakfast']::public.meal_slot[]);
  perform tt.ok((select count(*) from public.planned_meals where plan_id = v_plan) = 1, 'plan solo para hoy (US-139)');

  update public.meal_plans set status = 'confirmed' where id = v_plan;
  perform tt.throws($q$ select public.generate_plan(current_date, 7) $q$, 'plan_overlap_confirmed',
                    'no pisa un plan confirmado');
  perform tt.throws($q$ select public.generate_plan(current_date, 20) $q$, 'invalid_days', 'máximo 14 días');
  perform tt.reset();
end $$;
