-- ===================== Platos adicionales del día (migración 20261113000500) =====================
do $$
declare
  u uuid := '44444444-0000-0000-0000-000000000051';
  v_plan uuid;
  v_lunch public.planned_meals;
  v_extra jsonb;
  v_cost_before numeric;
  v_recipe uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data) values (u, 'extras@test.dev',
    jsonb_build_object('privacy_policy_document_id', private.latest_legal_document('privacy_policy'),
                       'terms_document_id', private.latest_legal_document('terms'), 'is_adult', true));
  update public.profiles set region_id = (select id from public.regions where code = 'CO-NAR-PASTO') where id = u;
  perform tt.login(u);
  v_plan := public.generate_plan(current_date, 1, array['lunch']::public.meal_slot[]);
  select * into v_lunch from public.planned_meals where plan_id = v_plan and slot = 'lunch';
  v_cost_before := (select estimated_cost from public.plan_budget_status(v_plan));

  -- Otra receta de almuerzo, distinta a la planeada (como la que sugiere el asistente)
  v_recipe := (select e.id from public.eligible_recipes('lunch') e where e.id <> v_lunch.recipe_id order by e.title limit 1);
  v_extra := public.cook_now(v_recipe, 'lunch', 2);

  perform tt.ok((select recipe_id from public.planned_meals where id = v_lunch.id) = v_lunch.recipe_id
                and (select status from public.planned_meals where id = v_lunch.id) = 'planned',
                'cocinar algo fuera del plan NO reemplaza el almuerzo planeado');
  perform tt.ok((select is_extra and status = 'cooked' and plan_id = v_plan from public.planned_meals
                 where id = (v_extra ->> 'planned_meal_id')::uuid),
                'queda como plato adicional, cocinado, en el plan de hoy');
  perform tt.ok((select estimated_cost from public.plan_budget_status(v_plan)) = v_cost_before,
                'los adicionales no cambian el costo estimado del plan');
  perform tt.ok(exists (select 1 from public.daily_nutrition(current_date) d where d.planned_meal_id = (v_extra ->> 'planned_meal_id')::uuid),
                'el adicional cuenta en Mi día');

  -- Las comidas planeadas siguen siendo una por momento del día
  perform tt.throws(format($q$ insert into public.planned_meals (plan_id, meal_date, slot, recipe_id, servings) values (%L, current_date, 'lunch', %L, 2) $q$,
                           v_plan, v_recipe), 'duplicate key', 'no puede haber dos almuerzos PLANEADOS el mismo día');

  -- Volver a generar el plan de hoy: el adicional cocinado no impide planear el almuerzo
  update public.meal_plans set status = 'draft' where id = v_plan;
  v_plan := public.generate_plan(current_date, 1, array['lunch']::public.meal_slot[]);
  perform tt.ok(exists (select 1 from public.planned_meals where plan_id = v_plan and slot = 'lunch' and not is_extra),
                'un adicional en el almuerzo no impide volver a planear el almuerzo');
  perform tt.ok(exists (select 1 from public.planned_meals where id = (v_extra ->> 'planned_meal_id')::uuid),
                'y el adicional no se pierde al regenerar');

  -- Calificar un adicional funciona igual que una comida del plan
  perform public.rate_meal((v_extra ->> 'planned_meal_id')::uuid, 5::smallint);
  perform tt.ok(exists (select 1 from public.recipe_ratings where planned_meal_id = (v_extra ->> 'planned_meal_id')::uuid),
                'un adicional se puede calificar');
  perform tt.reset();
end $$;
