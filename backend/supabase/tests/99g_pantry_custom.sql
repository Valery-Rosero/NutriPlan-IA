-- ===================== B3b: alimentos propios en la despensa (migración 20261113000400) =====================
do $$
declare
  a uuid := '44444444-0000-0000-0000-000000000041';
  b uuid := '44444444-0000-0000-0000-000000000042';
  v_item uuid;
  v_export jsonb;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (a, 'propio-a@test.dev', jsonb_build_object('privacy_policy_document_id', private.latest_legal_document('privacy_policy'),
                                                'terms_document_id', private.latest_legal_document('terms'), 'is_adult', true)),
    (b, 'propio-b@test.dev', jsonb_build_object('privacy_policy_document_id', private.latest_legal_document('privacy_policy'),
                                                'terms_document_id', private.latest_legal_document('terms'), 'is_adult', true));

  perform tt.login(a);
  insert into public.pantry_custom_items (name, food_group_id, store_category_id, quantity, unit, expires_on)
  values ('Queso campesino', (select id from public.food_groups where code = 'dairy'),
          (select id from public.ingredient_categories where code = 'dairy_eggs'), 500, 'g', current_date + 5)
  returning id into v_item;
  perform tt.ok((select user_id from public.pantry_custom_items where id = v_item) = a, 'el dueño es quien lo agrega (sin mandarlo)');
  insert into public.pantry_custom_items (name, quantity, unit) values ('Galletas de la tienda', 2, 'unit');
  perform tt.ok((select count(*) from public.pantry_custom_items) = 2, 'se pueden agregar sin grupo ni sección (la clasificación es opcional)');

  perform tt.throws($q$ insert into public.pantry_custom_items (name, quantity, unit) values ('Arroz', 1, 'taza') $q$, 'check',
                    'solo unidades conocidas');
  perform tt.throws($q$ insert into public.pantry_custom_items (name, quantity, unit) values ('Arroz', 0, 'g') $q$, 'check',
                    'la cantidad debe ser mayor que cero');
  perform tt.throws($q$ insert into public.pantry_custom_items (name, quantity, unit) values ('   ', 1, 'g') $q$, 'check',
                    'el nombre no puede estar vacío');
  perform tt.throws(format($q$ insert into public.pantry_custom_items (user_id, name, quantity, unit) values (%L, 'Pan', 1, 'unit') $q$, b),
                    'row-level security', 'no se agrega a la despensa de otra persona');

  v_export := public.export_my_data();
  perform tt.ok(jsonb_array_length(v_export -> 'pantry_custom') = 2, 'exportar mis datos incluye los alimentos propios');
  perform tt.ok(jsonb_array_length(v_export -> 'pantry') = 0, 'y la despensa del catálogo sigue aparte');

  update public.pantry_custom_items set quantity = 250 where id = v_item;
  perform tt.ok((select quantity from public.pantry_custom_items where id = v_item) = 250, 'se puede corregir la cantidad');
  perform tt.reset();

  perform tt.login(b);
  perform tt.ok(not exists (select 1 from public.pantry_custom_items), 'otra persona no ve esta despensa');
  delete from public.pantry_custom_items where id = v_item;
  perform tt.reset();
  perform tt.ok(exists (select 1 from public.pantry_custom_items where id = v_item), 'ni la puede borrar');

  perform tt.login(a);
  delete from public.pantry_custom_items where id = v_item;
  perform tt.ok(not exists (select 1 from public.pantry_custom_items where id = v_item), 'el dueño sí la borra');
  perform tt.reset();

  perform tt.ok(not has_table_privilege('anon', 'public.pantry_custom_items', 'select'), 'sin sesión no se lee');
end $$;
