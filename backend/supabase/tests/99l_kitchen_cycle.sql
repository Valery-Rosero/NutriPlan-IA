-- ===================== Mi cocina, fase 1: el ciclo lista → compra → despensa (migración 20261114000500, ADR-033) =====================
do $$
begin
  perform tt.ok(private.food_singular(private.food_key('  Papas   CRIOLLAS! ')) = 'papa criolla', 'normaliza nombres: sin tildes, minúsculas y en singular');
  perform tt.ok(private.match_ingredient('limones') = (select id from public.ingredients where name = 'Limón'), '"limones" se reconoce como Limón del catálogo');
  perform tt.ok(private.match_ingredient('Galletas de la tienda') is null, 'lo que no está en el catálogo no se inventa');
end $$;

do $$
declare
  u uuid := '44444444-0000-0000-0000-000000000091';
  v uuid := '44444444-0000-0000-0000-000000000092';
  v_meta jsonb := jsonb_build_object('privacy_policy_document_id', private.latest_legal_document('privacy_policy'),
                                     'terms_document_id', private.latest_legal_document('terms'), 'is_adult', true);
  v_plan uuid;
  v_list uuid;
  v_banano uuid := (select id from public.ingredients where name = 'Banano');
  v_limon uuid := (select id from public.ingredients where name = 'Limón');
  v_row public.shopping_list_items;
  v_plan_ing uuid;
  v_plan_need numeric;
  v_n int;
begin
  insert into auth.users (id, email, raw_user_meta_data) values (u, 'ciclo-u@test.dev', v_meta), (v, 'ciclo-v@test.dev', v_meta);
  update public.profiles set region_id = (select id from public.regions where code = 'CO-NAR-PASTO') where id in (u, v);
  perform tt.login(u);
  v_plan := public.generate_plan(current_date, 3, array['lunch', 'dinner']::public.meal_slot[]);
  v_list := public.generate_shopping_list(v_plan);

  -- C1 · lo que falta de una receta entra como INGREDIENTE con sus gramos, y se suma si se agrega otra vez
  v_n := public.add_ingredients_to_list(v_list, jsonb_build_array(jsonb_build_object('ingredient_id', v_banano, 'grams', 240)));
  select * into v_row from public.shopping_list_items where list_id = v_list and ingredient_id = v_banano;
  perform tt.ok(v_n = 1 and v_row.source = 'manual' and v_row.to_buy_g = 240, 'lo agregado desde una receta entra como ingrediente con sus gramos');
  perform public.add_ingredients_to_list(v_list, jsonb_build_array(jsonb_build_object('ingredient_id', v_banano, 'grams', 100)));
  perform tt.ok((select to_buy_g from public.shopping_list_items where id = v_row.id) = 340, 'agregarlo otra vez suma, no duplica');

  -- Lo escrito a mano: un ingrediente del catálogo ("limones"), algo propio y algo que no es comida
  insert into public.shopping_list_items (list_id, custom_name) values (v_list, 'limones'), (v_list, 'Galletas de la tienda'), (v_list, 'Bolsas');
  perform tt.reset();
  insert into public.food_labels (key, name, is_food, store_category_id, model)
  values ('bolsas', 'Bolsas', false, (select id from public.ingredient_categories where code = 'other'), 'test')
  on conflict (key) do nothing;
  perform tt.login(u);

  update public.shopping_list_items set is_checked = true, checked_at = now()
  where list_id = v_list and (ingredient_id = v_banano or custom_name in ('limones', 'Galletas de la tienda', 'Bolsas'));
  v_n := public.move_checked_to_pantry(v_list);

  perform tt.ok((select sum(quantity_g) from public.pantry_items where user_id = u and ingredient_id = v_banano) = 360,
                'C1 · al comprarlo, lo agregado desde la receta llega a la despensa (340 g = 3 bananos = 360 g, ADR-035)');
  perform tt.ok((select sum(quantity_g) from public.pantry_items where user_id = u and ingredient_id = v_limon) = private.default_purchase_g(v_limon),
                'lo escrito a mano que existe en el catálogo ("limones") llega como Limón');
  perform tt.ok(exists (select 1 from public.pantry_custom_items where user_id = u and name = 'Galletas de la tienda' and quantity = 1 and unit = 'unit'),
                'lo escrito a mano fuera del catálogo llega como alimento propio');
  perform tt.ok(not exists (select 1 from public.pantry_custom_items where user_id = u and name = 'Bolsas'),
                'lo que no es comida solo se cierra');
  perform tt.ok(v_n = 3, 'cuenta lo que entró a la despensa (banano, limón y galletas)');
  perform tt.ok(not exists (select 1 from public.shopping_list_items where list_id = v_list and is_checked and moved_to_pantry_at is null),
                'todo lo comprado queda cerrado');

  -- Ya comprado y se vuelve a necesitar: vuelve a la lista con lo nuevo
  perform public.add_ingredients_to_list(v_list, jsonb_build_array(jsonb_build_object('ingredient_id', v_banano, 'grams', 120)));
  perform tt.ok((select not is_checked and moved_to_pantry_at is null and to_buy_g = 120 from public.shopping_list_items
                 where list_id = v_list and ingredient_id = v_banano),
                'lo ya comprado vuelve a la lista sin marcar con la cantidad nueva');

  -- Si el plan necesita algo agregado a mano (sin comprar), la fila pasa a ser del plan
  select ingredient_id, needed_g into v_plan_ing, v_plan_need from public.shopping_list_items
  where list_id = v_list and source = 'plan' and not is_checked order by needed_g desc limit 1;
  perform tt.reset();
  delete from public.shopping_list_items where list_id = v_list and ingredient_id = v_plan_ing;
  perform tt.login(u);
  perform public.add_ingredients_to_list(v_list, jsonb_build_array(jsonb_build_object('ingredient_id', v_plan_ing, 'grams', 10)));
  perform public.generate_shopping_list(v_plan);
  perform tt.ok((select source = 'plan' and needed_g = v_plan_need from public.shopping_list_items where list_id = v_list and ingredient_id = v_plan_ing),
                'regenerar no queda bloqueado por una fila manual del mismo ingrediente: el plan toma su cantidad');

  -- Validaciones
  perform tt.throws(format($q$ select public.add_ingredients_to_list(%L, %L::jsonb) $q$, v_list,
                           jsonb_build_array(jsonb_build_object('ingredient_id', v_banano, 'grams', 0))), 'invalid_quantity', 'cantidades en cero se rechazan');
  perform tt.ok((select coalesce(bool_and(w.grams > 0), true) from public.what_to_buy_next(10) w),
                '"Para completar más recetas" dice cuánto comprar');

  perform tt.login(v);
  perform tt.throws(format($q$ select public.add_ingredients_to_list(%L, %L::jsonb) $q$, v_list,
                           jsonb_build_array(jsonb_build_object('ingredient_id', v_banano, 'grams', 10))), 'list_not_found', 'otra persona no puede agregar a mi lista');
  perform tt.reset();
  delete from auth.users where id in (u, v);
end $$;
