-- ===================== Sprint 5: lista de compras (migración 20261014000400) =====================
do $$
declare
  q uuid := '44444444-0000-0000-0000-000000000012';
  v_plan uuid; v_list uuid; v_huevos uuid := (select id from public.recipes where title = 'Huevos revueltos con espinaca');
  v_huevo uuid := (select id from public.ingredients where name = 'Huevo');
  r record;
begin
  update public.ingredients set is_staple = true where name in ('Sal', 'Aceite de oliva');
  insert into auth.users (id, email, raw_user_meta_data) values (q, 'q@test.dev',
    jsonb_build_object('privacy_policy_document_id', private.latest_legal_document('privacy_policy'),
                       'terms_document_id', private.latest_legal_document('terms'), 'is_adult', true));
  perform tt.login(q);
  v_plan := public.save_generated_plan(current_date + 30, current_date + 30,
    jsonb_build_array(jsonb_build_object('meal_date', current_date + 30, 'slot', 'breakfast', 'recipe_id', v_huevos, 'servings', 2)));
  v_list := public.generate_shopping_list(v_plan);

  perform tt.ok(not exists (select 1 from public.my_shopping_items where list_id = v_list and name in ('Sal', 'Aceite de oliva')),
                'los básicos (sal, aceite) no llenan la lista');
  select * into r from public.my_shopping_items where list_id = v_list and ingredient_id = v_huevo;
  perform tt.ok(r.to_buy_g = 200 and r.approx_units = 4 and r.category_name is not null,
                'huevos: 200 g ≈ 4 unidades, con su sección del supermercado');

  update public.shopping_list_items set is_checked = true, checked_at = now() where list_id = v_list and ingredient_id = v_huevo;
  perform tt.ok(public.move_checked_to_pantry(v_list) = 1, 'lo comprado pasa a la despensa');
  perform tt.ok((select sum(quantity_g) from public.pantry_items where ingredient_id = v_huevo) = 200
                and (select max(expires_on) from public.pantry_items where ingredient_id = v_huevo) = current_date + 21,
                'con el vencimiento según la vida útil del ingrediente (huevo: 21 días)');
  perform tt.ok(public.move_checked_to_pantry(v_list) = 0, 'no se suma dos veces');

  perform public.generate_shopping_list(v_plan);
  perform tt.ok((select to_buy_g from public.my_shopping_items where list_id = v_list and ingredient_id = v_huevo) = 0,
                'al actualizar la lista, lo que ya está en la despensa queda en 0');
  perform tt.reset();

  perform tt.login('aaaaaaaa-0000-0000-0000-000000000001');
  perform tt.ok(not exists (select 1 from public.my_shopping_items where list_id = v_list), 'otra persona no ve esta lista');
  perform tt.throws(format($q$ select public.move_checked_to_pantry(%L) $q$, v_list), 'list_not_found',
                    'ni puede pasar sus compras a su despensa');
  perform tt.reset();
end $$;
