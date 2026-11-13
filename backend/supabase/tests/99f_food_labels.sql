-- ===================== B3: caché de clasificación de alimentos (migración 20261113000300) =====================
do $$
declare
  q uuid := '44444444-0000-0000-0000-000000000031';
begin
  -- La función (service_role) escribe; aquí, como postgres.
  insert into public.food_labels (key, name, is_food, food_group_id, store_category_id, meal_slot, kcal_per_serving, protein_g_per_serving, model)
  values ('empanada', 'Empanada', true, (select id from public.food_groups where code = 'grains'),
          (select id from public.ingredient_categories where code = 'bakery'), 'snack', 250, 6, 'gemini-test');
  insert into public.food_labels (key, name, is_food, store_category_id, model)
  values ('bolsas de basura', 'Bolsas de basura', false, (select id from public.ingredient_categories where code = 'other'), 'gemini-test');

  perform tt.throws($q$ insert into public.food_labels (key, name, is_food, food_group_id, store_category_id)
                        values ('jabon', 'Jabón', false, 16, 8) $q$, 'check', 'lo que no es comida no lleva grupo de alimento');
  perform tt.throws($q$ insert into public.food_labels (key, name, is_food, store_category_id)
                        values ('arepa', 'Arepa', true, 4) $q$, 'check', 'la comida sí lleva grupo');
  perform tt.throws($q$ insert into public.food_labels (key, name, is_food, food_group_id, store_category_id)
                        values ('Queso Campesino', 'Queso', true, 5, 3) $q$, 'check', 'la llave va normalizada (minúsculas, sin tildes)');
  perform tt.throws($q$ insert into public.food_labels (key, name, is_food, food_group_id, store_category_id, kcal_per_serving)
                        values ('torta', 'Torta', true, 9, 4, 5000) $q$, 'check', 'calorías en un rango razonable');

  insert into auth.users (id, email, raw_user_meta_data) values (q, 'labels@test.dev',
    jsonb_build_object('privacy_policy_document_id', private.latest_legal_document('privacy_policy'),
                       'terms_document_id', private.latest_legal_document('terms'), 'is_adult', true));
  perform tt.login(q);
  perform tt.ok((select count(*) from public.food_labels where key in ('empanada', 'bolsas de basura')) = 2,
                'cualquier persona con sesión lee la caché (no tiene datos personales)');
  perform tt.throws($q$ insert into public.food_labels (key, name, is_food, food_group_id, store_category_id)
                        values ('pan', 'Pan', true, 9, 4) $q$, 'permission', 'la app no puede escribir en la caché');
  perform tt.throws($q$ update public.food_labels set kcal_per_serving = 1 where key = 'empanada' $q$, 'permission',
                    'ni cambiarla');
  perform tt.reset();

  perform tt.ok(not has_table_privilege('anon', 'public.food_labels', 'select'), 'sin sesión no se lee');
  perform tt.ok('label' = any (enum_range(null::public.ai_kind)::text[]), 'el uso de IA para clasificar se registra con su tipo');
end $$;
