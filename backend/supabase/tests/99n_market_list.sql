-- ===================== Mi cocina, fase 3: una lista que se puede usar en el súper (migración 20261114000700, ADR-035) =====================
do $$
declare
  id_of jsonb := (select jsonb_object_agg(name, id) from public.ingredients);
  p record;
begin
  -- A2 · cómo se compra
  select * into p from private.purchase((id_of ->> 'Cilantro')::uuid, 10);
  perform tt.ok(p.kind = 'pinch', 'hierbas y especias: "un poco"');
  select * into p from private.purchase((id_of ->> 'Huevo')::uuid, 120);
  perform tt.ok(p.kind = 'unit' and p.units = 3 and p.grams = 150, '120 g de huevo = 3 unidades (150 g)');
  select * into p from private.purchase((id_of ->> 'Leche entera')::uuid, 300);
  perform tt.ok(p.kind = 'ml' and p.grams = 500, 'la leche (en las recetas va por volumen) se compra por litros: medio litro');
  select * into p from private.purchase((id_of ->> 'Espinaca')::uuid, 38);
  perform tt.ok(p.kind = 'piece' and p.grams = 250, '38 g de una verdura = "un pedazo pequeño"');
  select * into p from private.purchase((id_of ->> 'Pechuga de pollo')::uuid, 600);
  perform tt.ok(p.kind = 'weight' and p.grams = 750, '600 g de pollo = libra y media (de a media libra)');
  select * into p from private.purchase((id_of ->> 'Pechuga de pollo')::uuid, 3200);
  perform tt.ok(p.kind = 'weight' and p.grams = 3500, 'más de 3 kg, de a medio kilo');
  select * into p from private.purchase((id_of ->> 'Pechuga de pollo')::uuid, 0);
  perform tt.ok(p.kind = 'none' and p.grams = 0, 'si no falta nada, no se compra nada');
end $$;

do $$
declare
  u uuid := '44444444-0000-0000-0000-000000000095';
  v uuid := '44444444-0000-0000-0000-000000000096';
  v_meta jsonb := jsonb_build_object('privacy_policy_document_id', private.latest_legal_document('privacy_policy'),
                                     'terms_document_id', private.latest_legal_document('terms'), 'is_adult', true);
  v_house uuid;
  v_plan uuid;
  v_list uuid;
  v_espinaca uuid := (select id from public.ingredients where name = 'Espinaca');
  v_item uuid;
  v_plan_item uuid;
  v_n int;
  v_buy numeric;
  v_need numeric;
begin
  insert into auth.users (id, email, raw_user_meta_data) values (u, 'casa-u@test.dev', v_meta), (v, 'casa-v@test.dev', v_meta);
  update public.profiles set region_id = (select id from public.regions where code = 'CO-NAR-PASTO') where id in (u, v);
  perform tt.login(u);

  -- A1 · sin plan también hay lista
  v_house := public.my_house_list();
  perform tt.ok(v_house is not null and public.my_house_list() = v_house, 'sin plan hay una lista de la casa, siempre la misma');
  perform public.add_ingredients_to_list(v_house, jsonb_build_array(jsonb_build_object('ingredient_id', v_espinaca, 'grams', 38)));
  insert into public.shopping_list_items (list_id, custom_name) values (v_house, 'aguacate');
  perform tt.ok((select buy_kind from public.my_shopping_items where list_id = v_house and ingredient_id = v_espinaca) = 'piece',
                'en la lista de la casa se puede anotar y "agregar lo que falta" (y dice cómo comprarlo)');

  -- M5 · quitar se puede deshacer
  select id into v_item from public.shopping_list_items where list_id = v_house and custom_name = 'aguacate';
  update public.shopping_list_items set dismissed_at = now() where id = v_item;
  perform tt.ok(not exists (select 1 from public.my_shopping_items where id = v_item), 'lo quitado no se ve en la lista');
  update public.shopping_list_items set dismissed_at = null where id = v_item;
  perform tt.ok(exists (select 1 from public.my_shopping_items where id = v_item), 'y deshacer lo trae de vuelta');

  -- Al armar la semana, lo anotado en la casa pasa a la lista del plan
  v_plan := public.generate_plan(current_date, 3, array['lunch', 'dinner']::public.meal_slot[]);
  v_list := public.generate_shopping_list(v_plan);
  perform tt.ok(exists (select 1 from public.my_shopping_items where list_id = v_list and name = 'aguacate')
                and exists (select 1 from public.my_shopping_items where list_id = v_list and ingredient_id = v_espinaca)
                and not exists (select 1 from public.shopping_list_items where list_id = v_house and not is_checked),
                'al armar la lista de la semana, lo anotado en la casa pasa a ella');

  -- Lo del plan que se quita no vuelve al rehacer la lista
  select id into v_plan_item from public.shopping_list_items where list_id = v_list and source = 'plan' and to_buy_g > 0 limit 1;
  update public.shopping_list_items set dismissed_at = now() where id = v_plan_item;
  perform public.generate_shopping_list(v_plan);
  perform tt.ok((select dismissed_at is not null from public.shopping_list_items where id = v_plan_item),
                'lo del plan que se quitó sigue quitado aunque la lista se rehaga');
  perform public.add_ingredients_to_list(v_list, jsonb_build_array(jsonb_build_object(
    'ingredient_id', (select ingredient_id from public.shopping_list_items where id = v_plan_item), 'grams', 100)));
  perform tt.ok((select dismissed_at is null from public.shopping_list_items where id = v_plan_item),
                'si se vuelve a pedir (receta o sugerencia), vuelve a la lista');

  -- A pasar a la despensa va lo que se compró (lo redondeado), y no lo quitado
  select buy_g, to_buy_g into v_buy, v_need from public.my_shopping_items where list_id = v_list and ingredient_id = v_espinaca;
  update public.shopping_list_items set is_checked = true, checked_at = now() where list_id = v_list and ingredient_id = v_espinaca;
  update public.shopping_list_items set is_checked = true, checked_at = now(), dismissed_at = now() where list_id = v_list and custom_name = 'aguacate';
  v_n := public.move_checked_to_pantry(v_list);
  perform tt.ok(v_buy >= v_need and v_buy % 250 = 0
                and (select sum(quantity_g) from public.pantry_items where user_id = u and ingredient_id = v_espinaca) = v_buy
                and not exists (select 1 from public.pantry_custom_items where user_id = u and name = 'aguacate'),
                'a la despensa pasa lo que se compra (redondeado como se vende), no lo exacto; lo quitado no');
  perform tt.reset();

  perform tt.login(v);
  perform tt.ok(not exists (select 1 from public.shopping_lists where id = v_house)
                and public.my_house_list() <> v_house, 'cada quien tiene su lista de la casa y no ve la ajena');
  perform tt.throws(format($q$ select public.add_ingredients_to_list(%L::uuid, '[{"ingredient_id":"%s","grams":10}]'::jsonb) $q$, v_house, v_espinaca),
                    'list_not_found', 'ni puede agregar a la lista de la casa ajena');
  perform tt.reset();
end $$;
