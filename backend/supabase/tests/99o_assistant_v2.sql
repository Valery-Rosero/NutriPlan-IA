-- ===================== Asistente v2, entrega 1: IA primero (migración 20261114000900, ADR-037) =====================
do $$
declare
  r uuid := '44444444-0000-0000-0000-000000000097';   -- con alergia, dieta y gustos
  f uuid := '44444444-0000-0000-0000-000000000098';   -- sin alergias ni dietas
  v_meta jsonb := jsonb_build_object('privacy_policy_document_id', private.latest_legal_document('privacy_policy'),
                                     'terms_document_id', private.latest_legal_document('terms'), 'is_adult', true);
  v_ctx jsonb;
  v_avoid text[];
  v_arroz uuid := (select id from public.ingredients where name = 'Arroz blanco');
  v_mani  uuid := (select id from public.ingredients where name = 'Maní');
  v_id uuid;
  base jsonb := jsonb_build_object('title', 'Arroz con limón y chontaduro', 'slot', 'lunch', 'servings', 2,
                                   'prep_minutes', 10, 'cook_minutes', 20, 'steps', jsonb_build_array('Cocina el arroz.', 'Sirve con limón.'));
begin
  insert into auth.users (id, email, raw_user_meta_data) values (r, 'ia-r@test.dev', v_meta), (f, 'ia-f@test.dev', v_meta);
  update public.profiles set household_size = 2, budget_amount = 100000, budget_period = 'week', max_cook_minutes = 45 where id = r;

  perform tt.login(r);
  perform public.accept_consent(private.latest_legal_document('sensitive_data_authorization'));
  perform public.set_my_restrictions(array[(select id from public.allergens where code = 'peanuts')]::smallint[],
                                     array[(select id from public.diets where code = 'vegetarian')]::smallint[]);
  insert into public.user_disliked_ingredients (user_id, ingredient_id) values (r, (select id from public.ingredients where name = 'Cilantro'));
  insert into public.user_cuisines (user_id, cuisine_id) values (r, (select id from public.cuisines where code = 'colombian'));

  -- Lo que la IA sabe: preferencias tal cual y "no usar" sin el porqué
  v_ctx := public.assistant_profile();
  select array_agg(x) into v_avoid from jsonb_array_elements_text(v_ctx -> 'avoid') x;
  perform tt.ok(v_ctx ->> 'servings' = '2' and v_ctx ->> 'max_minutes' = '45' and v_ctx ->> 'budget' = 'tight'
                and v_ctx -> 'cuisines' = '["Colombiana"]'::jsonb and (v_ctx ->> 'restricted')::boolean,
                'la IA conoce porciones, tiempo, presupuesto (ajustado: $50.000 por persona a la semana) y cocinas favoritas');
  perform tt.ok(v_avoid @> array['Maní', 'Carnes rojas', 'Aves', 'Pescados', 'Mariscos', 'Cilantro'],
                '"no usar" junta alergia, dieta y gustos');
  perform tt.ok(v_ctx::text not like '%Vegetarian%' and v_ctx::text not like '%alerg%' and not (v_ctx ? 'allergens') and not (v_ctx ? 'diets'),
                'y no dice cuál es alergia ni qué dieta es (ADR-025)');
  perform tt.ok(v_avoid = (select array_agg(x order by x) from unnest(v_avoid) x), 'la lista va ordenada, sin pistas del origen');

  -- Con restricciones: solo del catálogo, y lo bloqueado nunca entra
  perform tt.throws(format($q$ select public.create_assistant_recipe(%L::jsonb) $q$,
                    base || jsonb_build_object('ingredients', jsonb_build_array(jsonb_build_object('ingredient_id', v_arroz, 'grams', 200),
                                                                                jsonb_build_object('name', 'Chontaduro', 'grams', 150)))),
                    'unknown_ingredient', 'con alergias o dietas, nada fuera del catálogo');
  perform tt.throws(format($q$ select public.create_assistant_recipe(%L::jsonb) $q$,
                    base || jsonb_build_object('ingredients', jsonb_build_array(jsonb_build_object('ingredient_id', v_arroz, 'grams', 200),
                                                                                jsonb_build_object('name', 'mani', 'grams', 50)))),
                    'blocked_ingredient', 'si la IA se equivoca y escribe "mani", la base lo reconoce y lo bloquea');
  perform tt.reset();

  -- Sin restricciones: libertad de ingredientes
  perform tt.login(f);
  v_ctx := public.assistant_profile();
  perform tt.ok(not (v_ctx ->> 'restricted')::boolean and v_ctx -> 'avoid' = '[]'::jsonb, 'sin alergias ni dietas: sin restricciones');
  v_id := public.create_assistant_recipe(base || jsonb_build_object('ingredients', jsonb_build_array(
            jsonb_build_object('ingredient_id', v_arroz, 'grams', 200),
            jsonb_build_object('name', 'limones', 'grams', 60),
            jsonb_build_object('name', 'Chontaduro', 'grams', 150))));
  perform tt.ok(exists (select 1 from public.recipe_ingredients ri join public.ingredients i on i.id = ri.ingredient_id
                        where ri.recipe_id = v_id and i.name = 'Limón'),
                'un nombre que está en el catálogo ("limones") entra como ese ingrediente (con nutrición y alérgenos)');
  perform tt.ok((select array_agg(name) from public.recipe_extra_ingredients where recipe_id = v_id) = array['Chontaduro'],
                'lo que no está en el catálogo queda aparte, como ingrediente libre');
  perform tt.throws(format($q$ select public.create_assistant_recipe(%L::jsonb) $q$,
                    base || jsonb_build_object('ingredients', jsonb_build_array(jsonb_build_object('name', 'Chontaduro', 'grams', 150)))),
                    'invalid_recipe', 'al menos un ingrediente del catálogo');
  perform tt.reset();

  -- Lo libre es tan privado como la receta
  perform tt.login(r);
  perform tt.ok(not exists (select 1 from public.recipe_extra_ingredients where recipe_id = v_id), 'otra persona no ve los ingredientes libres ajenos');
  perform tt.reset();
  perform tt.login(f);
  perform tt.ok(exists (select 1 from public.recipe_extra_ingredients where recipe_id = v_id), 'su autora sí');
  perform tt.reset();
end $$;
