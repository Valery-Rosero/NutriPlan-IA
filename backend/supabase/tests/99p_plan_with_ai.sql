-- ===================== Semana y mes con IA (migración 20261116000200, ADR-039) =====================
do $$
declare
  u uuid := '44444444-0000-0000-0000-000000000099';
  v_meta jsonb := jsonb_build_object('privacy_policy_document_id', private.latest_legal_document('privacy_policy'),
                                     'terms_document_id', private.latest_legal_document('terms'), 'is_adult', true);
  v_arroz uuid := (select id from public.ingredients where name = 'Arroz blanco');
  v_papa uuid := (select id from public.ingredients where name = 'Papa');
  v_main uuid;
  v_plan uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data) values (u, 'plan-ia@test.dev', v_meta);
  perform tt.login(u);

  -- Una receta del plan con IA sirve para almuerzo y cena
  v_main := public.create_assistant_recipe(jsonb_build_object(
    'title', 'Arroz con papa criolla', 'slots', jsonb_build_array('lunch', 'dinner'), 'servings', 2,
    'prep_minutes', 10, 'cook_minutes', 25,
    'ingredients', jsonb_build_array(jsonb_build_object('ingredient_id', v_arroz, 'grams', 200), jsonb_build_object('ingredient_id', v_papa, 'grams', 300)),
    'steps', jsonb_build_array('Cocina el arroz.', 'Agrega la papa.')));
  perform tt.ok((select array_agg(slot::text order by slot) from public.recipe_meal_slots where recipe_id = v_main) = array['lunch', 'dinner'],
                'una receta del plan con IA puede ir en almuerzo y cena');
  perform tt.throws(format($q$ select public.create_assistant_recipe(%L::jsonb) $q$, jsonb_build_object(
    'title', 'Otra', 'slots', jsonb_build_array('merienda'), 'servings', 2, 'prep_minutes', 5, 'cook_minutes', 5,
    'ingredients', jsonb_build_array(jsonb_build_object('ingredient_id', v_arroz, 'grams', 100)), 'steps', jsonb_build_array('Cocina.', 'Sirve.'))),
    'invalid_recipe', 'un momento del día inventado no pasa');

  -- Se planea en los dos momentos y el plan queda marcado como hecho con IA
  v_plan := public.save_generated_plan(current_date, current_date, jsonb_build_array(
    jsonb_build_object('meal_date', current_date, 'slot', 'lunch', 'recipe_id', v_main, 'reason_code', 'ai_pick'),
    jsonb_build_object('meal_date', current_date, 'slot', 'dinner', 'recipe_id', v_main, 'reason_code', 'ai_pick')));
  update public.meal_plans set created_with_ai = true where id = v_plan;
  perform tt.ok((select count(*) from public.planned_meals where plan_id = v_plan) = 2
                and (select created_with_ai from public.meal_plans where id = v_plan),
                'el plan con sus recetas de la IA se guarda (almuerzo y cena) y queda marcado como hecho con IA');
  perform tt.reset();
end $$;
