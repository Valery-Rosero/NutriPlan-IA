-- ===================== Sprint 3: vista previa y "Cocinar ahora" (migración 20261014000200) =====================
-- Continúa el estado de 80_flexible_recipes.sql: h tiene alergia al huevo y cerdo, habichuela y arveja en la despensa.
do $$
declare
  h uuid := '88888888-0000-0000-0000-000000000008';
  n uuid := '66666666-0000-0000-0000-000000000010';
  v_arroz uuid := (select id from public.recipes where title = 'Arroz salteado con lo que tengas');
  v_cerdo uuid := (select id from public.ingredients where name = 'Cerdo');
  v_huevo uuid := (select id from public.ingredients where name = 'Huevo');
  v_pollo uuid := (select id from public.ingredients where name = 'Pechuga de pollo');
  v jsonb;
begin
  perform tt.login(h);
  v := public.preview_recipe(v_arroz, 4, jsonb_build_array(jsonb_build_object('group_key', 1, 'ingredient_id', v_pollo)));
  perform tt.ok(v -> 'lines' @> jsonb_build_array(jsonb_build_object('ingredient_name', 'Pechuga de pollo', 'grams', 300)),
                'la vista previa usa la opción elegida (pollo, 300 g para 4)');
  perform tt.ok((v -> 'per_serving' ->> 'kcal')::numeric > 0, 'la vista previa trae la nutrición por porción');
  perform tt.ok(v -> 'lines' @> '[{"ingredient_name": "Habichuela", "in_pantry": true}]'::jsonb,
                'marca lo que ya está en la despensa');

  v := public.preview_recipe(v_arroz, 8, jsonb_build_array(jsonb_build_object('group_key', 1, 'ingredient_id', v_huevo)));
  perform tt.ok(not (v -> 'lines' @> '[{"ingredient_name": "Huevo"}]'::jsonb) and not (v -> 'allergens' ? 'egg'),
                'una elección con alérgeno se ignora: nunca aparece en la vista previa');
  perform tt.ok(v -> 'lines' @> '[{"group_key": 1}]'::jsonb, 'el grupo se resuelve igual con una opción segura');
  perform tt.ok((select (l ->> 'grams')::numeric from jsonb_array_elements(v -> 'lines') l where l ->> 'ingredient_name' = 'Arroz blanco') = 400,
                'escala a 8 porciones (arroz 200 g → 400 g)');

  v := public.cook_now(v_arroz, 'lunch', 4, jsonb_build_array(jsonb_build_object('group_key', 1, 'ingredient_id', v_cerdo)));
  perform tt.ok((select sum(quantity_g) from public.pantry_items where ingredient_id = v_cerdo) = 200,
                'cocinar ahora descuenta 300 g de los 500 g de cerdo');
  perform tt.ok(v -> 'shortfall' @> '[{"ingredient_name": "Arroz blanco"}]'::jsonb, 'informa lo que faltó (arroz)');
  perform tt.throws(format($q$ select public.cook_now(%L, 'lunch', 4) $q$, v_arroz), 'meal_not_pending',
                    'no se registra dos veces el almuerzo de hoy');
  perform public.undo_meal_cooked((v ->> 'planned_meal_id')::uuid);
  perform tt.ok((select sum(quantity_g) from public.pantry_items where ingredient_id = v_cerdo) = 500, 'deshacer devuelve el cerdo');
  perform tt.throws(format($q$ select public.cook_now(%L, 'breakfast', 4) $q$, v_arroz), 'slot_mismatch',
                    'no se cocina un almuerzo como desayuno');
  perform tt.reset();

  -- sin plan previo: se crea un plan de un día
  insert into auth.users (id, email, raw_user_meta_data) values (n, 'n@test.dev',
    jsonb_build_object('privacy_policy_document_id', private.latest_legal_document('privacy_policy'),
                       'terms_document_id', private.latest_legal_document('terms'), 'is_adult', true));
  perform tt.login(n);
  v := public.cook_now(v_arroz, 'dinner', 2);
  perform tt.ok((select count(*) from public.meal_plans where start_date = current_date and end_date = current_date) = 1,
                'sin plan previo se crea un plan de un día');
  perform tt.ok((select status from public.planned_meals where id = (v ->> 'planned_meal_id')::uuid) = 'cooked',
                'la comida queda cocinada');
  perform tt.reset();
end $$;
