-- ===================== Recetas creadas por el asistente (migración 20261114000100, ADR-029) =====================
do $$
declare
  u uuid := '44444444-0000-0000-0000-000000000061';   -- alérgica al huevo
  v uuid := '44444444-0000-0000-0000-000000000062';   -- otra persona
  v_meta jsonb := jsonb_build_object('privacy_policy_document_id', private.latest_legal_document('privacy_policy'),
                                     'terms_document_id', private.latest_legal_document('terms'), 'is_adult', true);
  v_papa uuid := (select id from public.ingredients where name = 'Papa');
  v_pollo uuid := (select id from public.ingredients where name = 'Pechuga de pollo');
  v_cebolla uuid := (select id from public.ingredients where name = 'Cebolla cabezona');
  v_huevo uuid := (select id from public.ingredients where name = 'Huevo');
  v_recipe jsonb;
  r uuid;
  r2 uuid;
  v_extra jsonb;
  v_preview jsonb;
  v_plan uuid;
  v_lunch public.planned_meals;
  v_catalog uuid;
  v_conv uuid;
  v_msg bigint;
begin
  insert into auth.users (id, email, raw_user_meta_data) values (u, 'ia-recetas@test.dev', v_meta), (v, 'ia-otra@test.dev', v_meta);
  update public.profiles set region_id = (select id from public.regions where code = 'CO-NAR-PASTO') where id in (u, v);
  insert into public.user_consents (user_id, document_id) values (u, private.latest_legal_document('sensitive_data_authorization'));
  insert into public.user_allergens (user_id, allergen_id) select u, id from public.allergens where code = 'egg';
  insert into public.pantry_items (user_id, ingredient_id, quantity_g, expires_on) values (u, v_papa, 1000, current_date + 2);

  perform tt.login(u);

  -- Lo que la IA puede usar: nada de lo bloqueado; sabe qué hay en la cocina y qué vence pronto.
  perform tt.ok(not exists (select 1 from public.assistant_ingredients() where ingredient_id = v_huevo),
                'la lista para la IA no incluye lo que la persona no puede comer (huevo)');
  perform tt.ok((select in_pantry and expiring from public.assistant_ingredients() where ingredient_id = v_papa),
                'la lista dice que la papa está en la cocina y vence pronto');
  perform tt.ok(not (select in_pantry from public.assistant_ingredients() where ingredient_id = v_pollo),
                'y que el pollo hay que comprarlo');

  v_recipe := jsonb_build_object(
    'title', 'Pollo salteado con papa', 'description', 'Rápido y rendidor.', 'slot', 'lunch', 'servings', 2,
    'prep_minutes', 10, 'cook_minutes', 20,
    'ingredients', jsonb_build_array(
      jsonb_build_object('ingredient_id', v_papa, 'grams', 400),
      jsonb_build_object('ingredient_id', v_pollo, 'grams', 300),
      jsonb_build_object('ingredient_id', v_cebolla, 'grams', 80)),
    'steps', jsonb_build_array('Pela y corta la papa en cubos.', 'Saltea el pollo con la cebolla.', 'Junta todo y sirve.'));
  r := public.create_assistant_recipe(v_recipe);

  perform tt.ok((select status = 'draft' and created_by_assistant and author_id = u and total_minutes = 30 and base_servings = 2
                 from public.recipes where id = r),
                'se guarda como borrador privado del asistente, de la persona');
  perform tt.ok((select count(*) from public.recipe_ingredients where recipe_id = r) = 3
                and (select count(*) from public.recipe_steps where recipe_id = r) = 3
                and exists (select 1 from public.recipe_meal_slots where recipe_id = r and slot = 'lunch'),
                'con sus ingredientes (en gramos), pasos y momento del día');
  perform tt.ok(not exists (select 1 from public.eligible_recipes('lunch') e where e.id = r),
                'nunca entra al conjunto del plan automático');

  v_preview := public.preview_recipe(r, 2);
  perform tt.ok((v_preview -> 'per_serving' ->> 'kcal')::numeric > 0,
                'la nutrición la calcula la base con el catálogo');
  perform tt.ok(exists (select 1 from jsonb_array_elements(v_preview -> 'lines') l
                        where (l ->> 'ingredient_id')::uuid = v_papa and (l ->> 'in_pantry')::boolean),
                'la vista previa dice qué está en la cocina');

  -- Seguridad: nada bloqueado, nada fuera del catálogo, nada fuera de rango.
  perform tt.throws(format($q$ select public.create_assistant_recipe(%L::jsonb) $q$,
    jsonb_set(v_recipe, '{ingredients}', (v_recipe -> 'ingredients') || jsonb_build_array(jsonb_build_object('ingredient_id', v_huevo, 'grams', 100)))),
    'blocked_ingredient', 'una receta con huevo para alguien alérgica al huevo se rechaza');
  perform tt.throws(format($q$ select public.create_assistant_recipe(%L::jsonb) $q$,
    jsonb_set(v_recipe, '{ingredients}', jsonb_build_array(jsonb_build_object('ingredient_id', gen_random_uuid(), 'grams', 100)))),
    'unknown_ingredient', 'un ingrediente que no está en el catálogo se rechaza');
  perform tt.throws(format($q$ select public.create_assistant_recipe(%L::jsonb) $q$,
    jsonb_set(v_recipe, '{ingredients}', jsonb_build_array(jsonb_build_object('ingredient_id', v_papa, 'grams', 5000)))),
    'invalid_recipe', 'cantidades absurdas se rechazan');
  perform tt.throws(format($q$ select public.create_assistant_recipe(%L::jsonb) $q$,
    jsonb_set(v_recipe, '{ingredients}', jsonb_build_array(jsonb_build_object('ingredient_id', v_papa, 'grams', 100),
                                                          jsonb_build_object('ingredient_id', v_papa, 'grams', 200)))),
    'invalid_recipe', 'un ingrediente repetido se rechaza');
  perform tt.throws(format($q$ select public.create_assistant_recipe(%L::jsonb) $q$, jsonb_set(v_recipe, '{steps}', '[]'::jsonb)),
    'invalid_recipe', 'sin pasos no hay receta');
  perform tt.throws(format($q$ select public.create_assistant_recipe(%L::jsonb) $q$, jsonb_set(v_recipe, '{slot}', '"brunch"'::jsonb)),
    'invalid_recipe', 'un momento del día inventado se rechaza');
  update public.profiles set max_cook_minutes = 20 where id = u;
  perform tt.throws(format($q$ select public.create_assistant_recipe(%L::jsonb) $q$, v_recipe),
    'too_long', 'respeta el tiempo máximo de la persona');
  update public.profiles set max_cook_minutes = null where id = u;

  -- Cocinarla: como cualquier plato adicional del día.
  v_extra := public.cook_now(r, 'lunch', 2);
  perform tt.ok((select is_extra and status = 'cooked' and recipe_id = r from public.planned_meals
                 where id = (v_extra ->> 'planned_meal_id')::uuid),
                'la autora puede cocinar su receta del asistente (queda como adicional cocinado)');
  perform tt.ok((select quantity_g from public.pantry_items where user_id = u and ingredient_id = v_papa) < 1000,
                'y se descuenta de su cocina');

  -- Aplicar una de varias sugerencias a una comida del plan.
  v_plan := public.generate_plan(current_date + 1, 1, array['lunch']::public.meal_slot[]);
  select * into v_lunch from public.planned_meals where plan_id = v_plan and slot = 'lunch' and not is_extra;
  v_catalog := v_lunch.recipe_id;
  r2 := public.create_assistant_recipe(jsonb_set(v_recipe, '{title}', '"Papa criolla al horno"'));
  perform tt.reset();
  insert into public.assistant_conversations (user_id) values (u) returning id into v_conv;
  insert into public.assistant_messages (conversation_id, role, content, suggested_recipe_id, target_planned_meal_id)
  values (v_conv, 'assistant', 'Tres ideas', v_catalog, v_lunch.id) returning id into v_msg;
  insert into public.assistant_message_suggestions (message_id, position, recipe_id) values (v_msg, 1, v_catalog), (v_msg, 2, r2);
  perform tt.login(u);
  perform tt.ok((select count(*) from public.assistant_message_suggestions where message_id = v_msg) = 2,
                'la persona ve las sugerencias de su mensaje');
  perform tt.throws(format($q$ select public.apply_assistant_suggestion(%s, %L) $q$, v_msg, r),
                    'no_suggestion', 'no se puede aplicar una receta que ese mensaje no propuso');
  perform public.apply_assistant_suggestion(v_msg, r2);
  perform tt.ok((select recipe_id = r2 and replaced_recipe_id = v_catalog from public.planned_meals where id = v_lunch.id),
                'aplicar la receta del asistente la pone en la comida del plan');

  -- Otra persona: no la ve, no la cocina, no la crea a nombre de nadie.
  perform tt.login(v);
  perform tt.ok(not exists (select 1 from public.recipes where id = r), 'otra persona no ve la receta del asistente');
  perform tt.ok(not exists (select 1 from public.assistant_message_suggestions where message_id = v_msg),
                'ni las sugerencias de otra conversación');
  perform tt.throws(format($q$ select public.cook_now(%L, 'lunch', 2) $q$, r), 'recipe_not_published',
                    'ni la puede cocinar');
  perform tt.reset();

  -- Aunque se saltaran las demás reglas de publicación (triggers apagados), la restricción lo impide.
  set session_replication_role = replica;
  perform tt.throws(format($q$ update public.recipes set status = 'published', published_at = now() where id = %L $q$, r),
                    'recipes_assistant_stays_draft', 'una receta del asistente nunca se publica');
  set session_replication_role = origin;

  -- Borrar la cuenta borra sus recetas del asistente.
  delete from auth.users where id = u;
  set constraints all immediate;  -- la limpieza es diferida (corre al confirmar): aquí se adelanta
  perform tt.ok(not exists (select 1 from public.recipes where id in (r, r2)),
                'al borrar la cuenta, sus recetas del asistente se borran');
  delete from auth.users where id = v;
end $$;
