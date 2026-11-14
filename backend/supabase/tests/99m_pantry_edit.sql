-- ===================== Mi cocina, fase 2: corregir lo que hay (migración 20261114000600, ADR-034) =====================
do $$
declare
  u uuid := '44444444-0000-0000-0000-000000000093';
  v uuid := '44444444-0000-0000-0000-000000000094';
  v_meta jsonb := jsonb_build_object('privacy_policy_document_id', private.latest_legal_document('privacy_policy'),
                                     'terms_document_id', private.latest_legal_document('terms'), 'is_adult', true);
  v_huevo uuid := (select id from public.ingredients where name = 'Huevo');
  v_g smallint := (select id from public.units where code = 'g');
  v_unit smallint := (select w.unit_id from public.ingredient_unit_weights w where w.ingredient_id = (select id from public.ingredients where name = 'Huevo') limit 1);
  v_unit_g numeric;
  v_a uuid;
  v_b uuid;
  v_total numeric;
  v_n int;
begin
  insert into auth.users (id, email, raw_user_meta_data) values (u, 'editar-u@test.dev', v_meta), (v, 'editar-v@test.dev', v_meta);
  perform tt.login(u);

  -- Sumar: sin nada en la cocina, entra con la vida útil del alimento (huevo: 21 días)
  v_total := public.adjust_pantry(v_huevo, 200, v_g);
  perform tt.ok(v_total = 200 and (select expires_on from public.pantry_items where user_id = u and ingredient_id = v_huevo) = current_date + 21,
                'sumar sin lote vigente crea uno con el vencimiento según el alimento');

  -- Restar: primero lo que vence antes; lo que queda en 0 se borra
  perform public.add_to_pantry(v_huevo, 100, v_g, current_date + 2);
  v_total := public.adjust_pantry(v_huevo, -150, v_g);
  perform tt.ok(v_total = 150
                and not exists (select 1 from public.pantry_items where user_id = u and ingredient_id = v_huevo and expires_on = current_date + 2)
                and (select quantity_g from public.pantry_items where user_id = u and ingredient_id = v_huevo and expires_on = current_date + 21) = 150,
                'restar descuenta primero lo que vence antes y borra el lote que quedó en 0');

  -- En unidades (− / + de a un huevo)
  v_unit_g := private.to_grams(v_huevo, 1, v_unit);
  perform tt.ok(public.adjust_pantry(v_huevo, 2, v_unit) = 150 + 2 * v_unit_g, 'también se suma en unidades (2 huevos)');

  -- Lo vencido no se toca al restar
  perform public.add_to_pantry(v_huevo, 60, v_g, current_date - 1);
  v_total := public.adjust_pantry(v_huevo, -100000, v_g);
  perform tt.ok(v_total = 0
                and (select count(*) from public.pantry_items where user_id = u and ingredient_id = v_huevo) = 1
                and (select quantity_g from public.pantry_items where user_id = u and ingredient_id = v_huevo) = 60,
                '"se acabó" deja en 0 lo vigente; lo vencido tiene sus propias acciones');
  perform tt.throws(format($q$ select public.adjust_pantry(%L::uuid, 0, %s::smallint) $q$, v_huevo, v_g), 'invalid_quantity', 'sumar o restar 0 no tiene sentido');

  -- "Todavía sirve": la fecha del lote vencido se corre
  select id into v_a from public.pantry_items where user_id = u and ingredient_id = v_huevo;
  perform public.set_pantry_expiry(v_a, current_date + 2);
  perform tt.ok((select expires_on from public.pantry_items where id = v_a) = current_date + 2, '"todavía sirve" cambia la fecha del lote vencido');

  -- Cambiar la fecha a la de otro lote los junta
  v_b := (public.add_to_pantry(v_huevo, 40, v_g, current_date + 9)).id;
  perform public.set_pantry_expiry(v_a, current_date + 9);
  perform tt.ok(not exists (select 1 from public.pantry_items where id = v_a)
                and (select quantity_g from public.pantry_items where id = v_b) = 100,
                'si ya hay un lote con esa fecha, se juntan (60 g + 40 g)');
  perform public.set_pantry_expiry(v_b, null);
  perform tt.ok((select expires_on from public.pantry_items where id = v_b) is null, 'también se puede dejar sin fecha');
  perform tt.throws(format($q$ select public.set_pantry_expiry(%L, current_date + 1000) $q$, v_b), 'invalid_date', 'una fecha a años no tiene sentido');

  -- Quitar lo vencido (catálogo y alimentos propios)
  perform public.add_to_pantry(v_huevo, 50, v_g, current_date - 3);
  insert into public.pantry_custom_items (name, quantity, unit, expires_on) values ('Arepas de la tienda', 4, 'unit', current_date - 1),
                                                                                 ('Galletas', 1, 'unit', current_date + 10);
  v_n := public.remove_expired_pantry();
  perform tt.ok(v_n = 2
                and not exists (select 1 from public.pantry_items where user_id = u and expires_on < current_date)
                and (select count(*) from public.pantry_custom_items where user_id = u) = 1,
                '"Quitar lo vencido" quita solo lo vencido, del catálogo y lo propio');
  perform tt.reset();

  -- Otra persona no toca lo de u
  perform tt.login(v);
  perform tt.throws(format($q$ select public.set_pantry_expiry(%L, current_date) $q$, v_b), 'item_not_found', 'otra persona no cambia la fecha de un lote ajeno');
  perform tt.ok(public.adjust_pantry(v_huevo, -50, v_g) = 0 and public.remove_expired_pantry() = 0, 'ni resta ni quita de la cocina ajena');
  perform tt.reset();
  perform tt.ok((select quantity_g from public.pantry_items where id = v_b) = 100, 'lo de u sigue igual');
end $$;
