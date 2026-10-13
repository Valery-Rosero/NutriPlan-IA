-- ===================== Refuerzos R1–R8 (migración 20261013000100) =====================
do $$
declare
  e uuid := 'eeeeeeee-0000-0000-0000-000000000005';
  v_plan uuid; v_pm uuid; v_new uuid; v_rid uuid; v_old smallint; v_cur smallint;
  v_pollo uuid := (select id from public.recipes where title = 'Pollo con arroz y brócoli');
  v_avena uuid := (select id from public.recipes where title = 'Avena con banano y almendras');
  v_huevos uuid := (select id from public.recipes where title = 'Huevos revueltos con espinaca');
  v_g smallint := (select id from public.units where code = 'g');
begin
  insert into auth.users (id, email, raw_user_meta_data) values (e, 'e@test.dev',
    jsonb_build_object('privacy_policy_document_id', private.latest_legal_document('privacy_policy'),
                       'terms_document_id', private.latest_legal_document('terms'), 'is_adult', true));
  insert into public.user_consents (user_id, document_id) values (e, private.latest_legal_document('sensitive_data_authorization'));
  insert into public.user_diets (user_id, diet_id) select e, id from public.diets where code = 'vegetarian';

  -- R1 · el trigger del plan rechaza recetas fuera de la dieta (aunque no haya alérgeno)
  perform tt.login(e);
  insert into public.meal_plans (user_id, start_date, end_date) values (e, current_date, current_date + 6) returning id into v_plan;
  perform tt.throws(format($q$ insert into public.planned_meals (plan_id, meal_date, slot, recipe_id, servings) values (%L, current_date, 'lunch', %L, 2) $q$, v_plan, v_pollo),
                    'diet_conflict', 'R1: una persona vegetariana no puede tener pollo en el plan, venga de donde venga');
  -- R5 · tipo de comida
  perform tt.throws(format($q$ insert into public.planned_meals (plan_id, meal_date, slot, recipe_id, servings) values (%L, current_date, 'dinner', %L, 2) $q$, v_plan, v_avena),
                    'slot_mismatch', 'R5: un desayuno no se puede planear como cena');
  insert into public.planned_meals (plan_id, meal_date, slot, recipe_id, servings)
  values (v_plan, current_date + 1, 'dinner', v_huevos, 2) returning id into v_pm;
  perform tt.ok(not exists (select 1 from public.my_plan_conflicts), 'sin conflictos mientras el plan cumple la dieta');
  perform tt.reset();

  -- dieta declarada DESPUÉS de planear: el conflicto queda marcado, no se borra en silencio
  insert into public.user_diets (user_id, diet_id) select e, id from public.diets where code = 'vegan';
  perform tt.login(e);
  perform tt.ok((select conflict from public.my_plan_conflicts where planned_meal_id = v_pm) = 'diet',
                'R1: los huevos quedan marcados como conflicto de dieta al volverse vegana');
  perform tt.reset();
  delete from public.user_diets where user_id = e and diet_id = (select id from public.diets where code = 'vegan');

  -- R6 · deshacer: la ventana la pone el servidor, no el cliente
  perform tt.login(e);
  perform public.mark_meal_cooked(v_pm);
  perform tt.reset();
  update public.planned_meals set cooked_at = now() - interval '20 seconds' where id = v_pm;
  perform tt.login(e);
  perform tt.throws(format($q$ select public.undo_meal_cooked(%L, interval '1 year') $q$, v_pm),
                    'undo_window_expired', 'R6: pedir una ventana de un año no permite deshacer pasados 15 s');
  perform tt.reset();

  -- R3 · un ingrediente sin revisión de alérgenos bloquea la publicación
  insert into public.ingredients (name, food_group_id, store_category_id)
  select 'Salsa misteriosa', fg.id, c.id from public.food_groups fg, public.ingredient_categories c
  where fg.code = 'other' and c.code = 'pantry' returning id into v_new;
  insert into public.ingredient_nutrition (ingredient_id, kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, source)
  values (v_new, 100, 1, 10, 5, 0, 5, 500, 'prueba');
  insert into public.recipes (title, base_servings, prep_minutes) values ('Receta con salsa', 2, 5) returning id into v_rid;
  insert into public.recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id) values (v_rid, v_new, 50, v_g);
  insert into public.recipe_steps (recipe_id, step_number, instruction) values (v_rid, 1, 'Servir.');
  insert into public.recipe_meal_slots (recipe_id, slot) values (v_rid, 'snack');
  insert into public.nutritionist_reviews (recipe_id, reviewer_name, outcome) values (v_rid, 'Revisora dev', 'approved');
  perform tt.throws(format($q$ update public.recipes set status = 'published' where id = %L $q$, v_rid),
                    'allergens_unreviewed', 'R3: "sin alérgenos registrados" no basta: el ingrediente debe estar revisado');
  update public.ingredients set allergens_reviewed_at = now() where id = v_new;
  update public.recipes set status = 'published' where id = v_rid;
  perform tt.ok((select status from public.recipes where id = v_rid) = 'published', 'R3: con la revisión hecha la receta se publica');

  -- R7 · solo la versión vigente de un documento
  v_old := private.latest_legal_document('community_sharing');
  insert into public.legal_documents (kind, version) values ('community_sharing', 2) returning id into v_cur;
  perform tt.login(e);
  perform tt.throws(format($q$ select public.accept_consent(%s::smallint) $q$, v_old),
                    'consent_outdated', 'R7: no se acepta una versión vieja con accept_consent');
  perform tt.throws(format($q$ insert into public.user_consents (user_id, document_id) values (%L, %s) $q$, e, v_old),
                    'row-level security', 'R7: tampoco insertándola directamente');
  perform public.accept_consent(v_cur);
  perform tt.ok(private.has_consent(e, 'community_sharing'), 'R7: la versión vigente sí se acepta');
  perform tt.reset();
end $$;

-- R8 · la base trabaja con la hora de Colombia (sesión nueva de este archivo)
do $$
begin
  perform tt.ok(current_setting('TimeZone') = 'America/Bogota', 'R8: zona horaria America/Bogota');
end $$;
