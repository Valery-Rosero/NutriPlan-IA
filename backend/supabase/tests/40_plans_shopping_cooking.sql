-- ===================== Plan, validaciones y presupuesto =====================
do $$
declare
  a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  c uuid := 'cccccccc-0000-0000-0000-000000000003';
  v_plan uuid; v_plan_a uuid; v_draft uuid;
  v_bowl uuid := (select id from public.recipes where title = 'Bowl de garbanzos y espinaca');
  v_sopa uuid := (select id from public.recipes where title = 'Sopa de lentejas');
  v_avena uuid := (select id from public.recipes where title = 'Avena con banano y almendras');
  r record;
begin
  update public.profiles set budget_amount = 100000, budget_period = 'week',
         region_id = (select id from public.regions where code = 'CO-NAR-PASTO') where id = c;

  perform tt.login(c);
  insert into public.meal_plans (user_id, start_date, end_date) values (c, current_date, current_date + 6) returning id into v_plan;
  perform tt.ok((select budget_limit from public.meal_plans where id = v_plan) = 100000, 'el plan de 7 días toma el presupuesto semanal completo');
  perform tt.throws(format($q$ insert into public.meal_plans (user_id, start_date, end_date) values (%L, current_date + 3, current_date + 9) $q$, c),
                    'meal_plans_no_overlap', 'no se permiten dos planes que cubran el mismo día');
  perform tt.throws(format($q$ insert into public.meal_plans (user_id, start_date, end_date) values (%L, current_date + 20, current_date + 40) $q$, c),
                    'check', 'un plan no puede durar más de 14 días');

  insert into public.planned_meals (plan_id, meal_date, slot, recipe_id, servings) values
    (v_plan, current_date,     'dinner', v_bowl, 2),
    (v_plan, current_date + 1, 'lunch',  v_sopa, 4);
  perform tt.throws(format($q$ insert into public.planned_meals (plan_id, meal_date, slot, recipe_id, servings) values (%L, current_date, 'dinner', %L, 2) $q$, v_plan, v_sopa),
                    'duplicate key', 'no se puede planear dos recetas en la misma comida');
  perform tt.throws(format($q$ insert into public.planned_meals (plan_id, meal_date, slot, recipe_id, servings) values (%L, current_date + 30, 'lunch', %L, 2) $q$, v_plan, v_sopa),
                    'fuera', 'una comida fuera de las fechas del plan se rechaza');
  perform tt.reset();

  -- alergia: A no puede planear la avena con almendras
  perform tt.login(a);
  insert into public.meal_plans (user_id, start_date, end_date) values (a, current_date, current_date + 6) returning id into v_plan_a;
  perform tt.throws(format($q$ insert into public.planned_meals (plan_id, meal_date, slot, recipe_id, servings) values (%L, current_date, 'breakfast', %L, 2) $q$, v_plan_a, v_avena),
                    'allergen', 'el trigger rechaza una receta con un alérgeno del usuario');
  perform tt.reset();

  -- receta en borrador: no se puede planear
  insert into public.recipes (title, base_servings, prep_minutes) values ('Borrador', 2, 5) returning id into v_draft;
  perform tt.login(c);
  perform tt.throws(format($q$ insert into public.planned_meals (plan_id, meal_date, slot, recipe_id, servings) values (%L, current_date + 2, 'lunch', %L, 2) $q$, v_plan, v_draft),
                    'publi', 'no se puede planear una receta sin publicar');

  -- presupuesto
  select * into r from public.plan_budget_status(v_plan);
  perform tt.ok(r.estimated_cost > 0 and r.budget_limit = 100000 and r.over_by = 0 and r.currency_code = 'COP',
                format('estado de presupuesto: costo %s dentro del límite', r.estimated_cost));
  perform tt.ok(r.estimated_prices > 0, 'el presupuesto marca precios estimados (respaldo regional)');
  perform tt.reset();
  update public.meal_plans set budget_limit = 1000 where id = v_plan;
  perform tt.login(c);
  perform tt.ok((select over_by from public.plan_budget_status(v_plan)) > 0, 'con límite bajo se reporta el exceso');
  perform tt.reset();
  update public.meal_plans set budget_limit = 100000 where id = v_plan;

  -- aislamiento: A no puede calcular el presupuesto de C
  perform tt.login(a);
  perform tt.throws(format($q$ select * from public.plan_budget_status(%L) $q$, v_plan), 'region_required', 'A sin región no calcula costos');
  perform tt.reset();
end $$;

-- ===================== Lista de compras =====================
do $$
declare
  c uuid := 'cccccccc-0000-0000-0000-000000000003';
  v_plan uuid := (select id from public.meal_plans where user_id = c);
  v_list uuid; r record;
begin
  perform tt.login(c);
  v_list := public.generate_shopping_list(v_plan);
  perform tt.ok(v_list = public.generate_shopping_list(v_plan), 'generar la lista dos veces devuelve la misma lista (idempotente)');
  perform tt.ok((select count(*) from public.shopping_list_items where list_id = v_list and ingredient_id = (select id from public.ingredients where name = 'Lentejas secas')) = 1, 'sin duplicados al regenerar');
  select * into r from public.shopping_list_items
   where list_id = v_list and ingredient_id = (select id from public.ingredients where name = 'Lentejas secas');
  perform tt.ok(r.needed_g = 200 and r.pantry_g = 0 and r.to_buy_g = 200, 'lentejas: se necesitan 200 g y hay 0 en despensa -> comprar 200 g');
  select * into r from public.shopping_list_items
   where list_id = v_list and ingredient_id = (select id from public.ingredients where name = 'Garbanzos cocidos');
  perform tt.ok(r.needed_g = 300 and r.pantry_g = 1300 and r.to_buy_g = 0, 'garbanzos: cubiertos por la despensa -> comprar 0');
  select * into r from public.shopping_list_items
   where list_id = v_list and ingredient_id = (select id from public.ingredients where name = 'Zanahoria');
  perform tt.ok(r.needed_g = 160 and r.to_buy_g = 0, 'zanahoria: 2 unidades x 80 g, cubierta por la despensa');
  -- el usuario marca un ítem y luego cambia el plan: lo marcado se conserva
  update public.shopping_list_items set is_checked = true, checked_at = now()
   where list_id = v_list and ingredient_id = (select id from public.ingredients where name = 'Lentejas secas');
  perform tt.reset();
  delete from public.planned_meals where plan_id = v_plan and recipe_id = (select id from public.recipes where title = 'Sopa de lentejas');
  perform tt.login(c);
  perform public.generate_shopping_list(v_plan);
  perform tt.ok(exists (select 1 from public.shopping_list_items where list_id = v_list and ingredient_id = (select id from public.ingredients where name = 'Lentejas secas')),
                'un ítem ya marcado no se borra al regenerar');
  perform tt.ok(not exists (select 1 from public.shopping_list_items where list_id = v_list and ingredient_id = (select id from public.ingredients where name = 'Cebolla cabezona')),
                'los ítems sin marcar que ya no se necesitan sí se retiran');
  perform tt.reset();
end $$;

-- ===================== Cocinar: FIFO, faltantes y deshacer =====================
do $$
declare
  c uuid := 'cccccccc-0000-0000-0000-000000000003';
  v_plan uuid := (select id from public.meal_plans where user_id = c);
  v_bowl uuid := (select id from public.recipes where title = 'Bowl de garbanzos y espinaca');
  v_garb uuid := (select id from public.ingredients where name = 'Garbanzos cocidos');
  v_pm uuid; v_res jsonb;
begin
  -- 8 porciones del bowl = 1200 g de garbanzos: agota el lote que vence primero (+3) y toma del +10; el lote sin fecha queda intacto
  insert into public.planned_meals (plan_id, meal_date, slot, recipe_id, servings)
    values (v_plan, current_date + 2, 'lunch', v_bowl, 8) returning id into v_pm;
  perform tt.login(c);
  v_res := public.mark_meal_cooked(v_pm);
  perform tt.reset();
  perform tt.ok((select quantity_g from public.pantry_items where user_id = c and ingredient_id = v_garb and expires_on = current_date + 3) = 0, 'FIFO: primero se agota el lote que vence antes');
  perform tt.ok((select quantity_g from public.pantry_items where user_id = c and ingredient_id = v_garb and expires_on = current_date + 10) = 0, 'FIFO: luego toma del siguiente lote (200 g)');
  perform tt.ok((select quantity_g from public.pantry_items where user_id = c and ingredient_id = v_garb and expires_on is null) = 100, 'el lote sin vencimiento queda intacto');
  perform tt.ok(v_res -> 'shortfall' @> '[{"ingredient_name": "Espinaca"}]'::jsonb, 'se informa lo que faltaba en la despensa (espinaca) sin bloquear');
  perform tt.ok((select min(quantity_g) from public.pantry_items where user_id = c) >= 0, 'la despensa nunca queda en negativo');
  perform tt.ok((select status from public.planned_meals where id = v_pm) = 'cooked', 'la comida queda marcada como cocinada');

  perform tt.login(c);
  perform tt.throws(format($q$ select public.mark_meal_cooked(%L) $q$, v_pm), 'meal_not_pending', 'no se cocina dos veces la misma comida');
  perform public.undo_meal_cooked(v_pm);
  perform tt.reset();
  perform tt.ok((select status from public.planned_meals where id = v_pm) = 'planned', 'deshacer devuelve la comida a planeada');
  perform tt.ok((select sum(quantity_g) from public.pantry_items where user_id = c and ingredient_id = v_garb) = 1300, 'deshacer restaura la despensa exactamente (1300 g)');
  perform tt.ok((select count(*) from public.meal_pantry_deductions where planned_meal_id = v_pm) = 0, 'deshacer borra los descuentos registrados');

  perform tt.login(c);
  perform public.mark_meal_cooked(v_pm);
  perform tt.reset();
  update public.planned_meals set cooked_at = now() - interval '1 minute' where id = v_pm;
  perform tt.login(c);
  perform tt.throws(format($q$ select public.undo_meal_cooked(%L) $q$, v_pm), 'undo_window_expired', 'pasado el plazo ya no se puede deshacer');
  perform tt.reset();
end $$;

-- ===================== Asistente =====================
do $$
declare
  a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_plan uuid := (select id from public.meal_plans where user_id = a);
  v_avena uuid := (select id from public.recipes where title = 'Avena con banano y almendras');
  v_sopa uuid := (select id from public.recipes where title = 'Sopa de lentejas');
  v_pm uuid; v_conv uuid; v_m1 bigint; v_m2 bigint;
begin
  insert into public.planned_meals (plan_id, meal_date, slot, recipe_id, servings) values (v_plan, current_date, 'lunch', v_sopa, 2) returning id into v_pm;
  insert into public.assistant_conversations (user_id) values (a) returning id into v_conv;
  insert into public.assistant_messages (conversation_id, role, content, suggested_recipe_id, target_planned_meal_id)
    values (v_conv, 'assistant', 'Prueba la avena', v_avena, v_pm) returning id into v_m1;
  insert into public.assistant_messages (conversation_id, role, content, suggested_recipe_id, target_planned_meal_id)
    values (v_conv, 'assistant', 'Otra sopa', v_sopa, v_pm) returning id into v_m2;

  perform tt.login(a);
  perform tt.throws(format($q$ select public.apply_assistant_suggestion(%s) $q$, v_m1), 'not_eligible', 'una sugerencia del asistente con alérgeno es rechazada por la base');
  perform tt.ok((select applied_at is null from public.assistant_messages where id = v_m1), 'la sugerencia rechazada no queda marcada como aplicada');
  perform public.apply_assistant_suggestion(v_m2);
  perform tt.ok((select applied_at is not null from public.assistant_messages where id = v_m2), 'una sugerencia válida se aplica');
  perform tt.throws(format($q$ select public.apply_assistant_suggestion(%s) $q$, v_m2), 'already_applied', 'no se aplica dos veces');
  perform tt.throws(format($q$ update public.assistant_messages set content = 'x' where id = %s $q$, v_m2), 'denied', 'el usuario no puede editar mensajes del asistente');
  perform tt.reset();
end $$;
