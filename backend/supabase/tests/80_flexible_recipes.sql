-- ===================== Recetas versátiles (migración 20261013000200, ADR-020) =====================
-- f: alergia a huevo y pescado · g: vegana · h: sin restricciones, con cerdo, habichuela y arveja en la despensa

-- ---- Catálogo de prueba ------------------------------------------------------
do $$
declare
  v_arroz uuid; v_tortilla uuid;
  v_g smallint := (select id from public.units where code = 'g');
begin
  insert into public.ingredients (name, food_group_id, store_category_id, allergens_reviewed_at)
  select v.n, fg.id, c.id, now()
  from (values ('Cerdo','red_meat','meat_fish'), ('Atún en lata','fish','pantry'), ('Fríjol cocido','legumes','pantry'),
               ('Habichuela','vegetables','produce'), ('Arveja','vegetables','produce')) v(n, fg, cat)
  join public.food_groups fg on fg.code = v.fg join public.ingredient_categories c on c.code = v.cat;
  insert into public.ingredient_allergens (ingredient_id, allergen_id)
  select i.id, a.id from public.ingredients i, public.allergens a where i.name = 'Atún en lata' and a.code = 'fish';
  insert into public.ingredient_nutrition (ingredient_id, kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, source)
  select id, 150, 15, 5, 5, 2, 1, 50, 'prueba' from public.ingredients
  where name in ('Cerdo','Atún en lata','Fríjol cocido','Habichuela','Arveja');
  update public.ingredients set is_staple = true where name in ('Sal', 'Aceite de oliva', 'Comino molido');

  insert into public.recipes (title, description, base_servings, prep_minutes, cook_minutes)
  values ('Arroz salteado con lo que tengas', 'Arroz con la proteína y las verduras que haya en casa.', 4, 10, 20)
  returning id into v_arroz;
  insert into public.recipe_meal_slots (recipe_id, slot) values (v_arroz, 'lunch'), (v_arroz, 'dinner');
  insert into public.recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id, sort_order)
  select v_arroz, i.id, v.q, u.id, v.o
  from (values ('Arroz blanco', 200, 'g', 1), ('Aceite de oliva', 1, 'tbsp', 2), ('Sal', 1, 'tsp', 3)) v(n, q, unit, o)
  join public.ingredients i on i.name = v.n join public.units u on u.code = v.unit;
  insert into public.recipe_flex_groups (recipe_id, group_key, label, min_choices, max_choices, sort_order) values
    (v_arroz, 1, 'Proteína', 1, 1, 1), (v_arroz, 2, 'Verduras', 1, 2, 2), (v_arroz, 3, 'Para servir', 0, 1, 3);
  insert into public.recipe_flex_options (recipe_id, group_key, ingredient_id, quantity, unit_id, is_default)
  select v_arroz, v.gk, i.id, v.q, v_g, v.d
  from (values (1, 'Pechuga de pollo', 300, true), (1, 'Cerdo', 300, false), (1, 'Huevo', 200, false),
               (1, 'Atún en lata', 240, false), (1, 'Fríjol cocido', 300, false),
               (2, 'Zanahoria', 150, true), (2, 'Habichuela', 150, false), (2, 'Arveja', 150, false), (2, 'Brócoli', 150, false),
               (3, 'Cilantro', 10, false)) v(gk, n, q, d)
  join public.ingredients i on i.name = v.n;
  insert into public.recipe_steps (recipe_id, step_number, instruction) values
    (v_arroz, 1, 'Cocina el arroz.'), (v_arroz, 2, 'Saltea la proteína y las verduras; mezcla con el arroz.');
  insert into public.nutritionist_reviews (recipe_id, reviewer_name, outcome) values (v_arroz, 'Revisora dev', 'approved');
  update public.recipes set status = 'published' where id = v_arroz;
  perform tt.ok((select status from public.recipes where id = v_arroz) = 'published', 'una receta con grupos intercambiables se publica');

  -- receta cuyo único grupo obligatorio solo tiene huevo o atún
  insert into public.recipes (title, base_servings, prep_minutes) values ('Calentado con huevo o atún', 2, 10) returning id into v_tortilla;
  insert into public.recipe_meal_slots (recipe_id, slot) values (v_tortilla, 'lunch');
  insert into public.recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id)
  select v_tortilla, id, 200, v_g from public.ingredients where name = 'Arroz blanco';
  insert into public.recipe_flex_groups (recipe_id, group_key, label) values (v_tortilla, 1, 'Proteína');
  insert into public.recipe_flex_options (recipe_id, group_key, ingredient_id, quantity, unit_id, is_default)
  select v_tortilla, 1, id, 150, v_g, name = 'Huevo' from public.ingredients where name in ('Huevo', 'Atún en lata');
  insert into public.recipe_steps (recipe_id, step_number, instruction) values (v_tortilla, 1, 'Calienta todo junto.');
  insert into public.nutritionist_reviews (recipe_id, reviewer_name, outcome) values (v_tortilla, 'Revisora dev', 'approved');
  update public.recipes set status = 'published' where id = v_tortilla;

  perform tt.throws(format($q$ insert into public.recipe_flex_options (recipe_id, group_key, ingredient_id, quantity, unit_id)
                               select %L, 1, id, 100, %s from public.ingredients where name = 'Cerdo' $q$, v_tortilla, v_g),
                    'recipe_published_locked', 'las opciones de una receta publicada están bloqueadas');
end $$;

-- ---- Usuarios ----------------------------------------------------------------
do $$
declare
  f uuid := 'ffffffff-0000-0000-0000-000000000006';
  g uuid := '99999999-0000-0000-0000-000000000007';
  h uuid := '88888888-0000-0000-0000-000000000008';
  v_meta jsonb := jsonb_build_object('privacy_policy_document_id', private.latest_legal_document('privacy_policy'),
                                     'terms_document_id', private.latest_legal_document('terms'), 'is_adult', true);
begin
  insert into auth.users (id, email, raw_user_meta_data) values (f, 'f@test.dev', v_meta), (g, 'g@test.dev', v_meta), (h, 'h@test.dev', v_meta);
  insert into public.user_consents (user_id, document_id)
    select u, private.latest_legal_document('sensitive_data_authorization') from unnest(array[f, g, h]) u;
  insert into public.user_allergens (user_id, allergen_id) select f, id from public.allergens where code in ('egg', 'fish');
  insert into public.user_diets (user_id, diet_id) select g, id from public.diets where code = 'vegan';
  update public.profiles set household_size = 4, region_id = (select id from public.regions where code = 'CO-NAR-PASTO') where id = h;
end $$;

-- ---- Seguridad: las opciones peligrosas nunca aparecen ------------------------
do $$
declare
  f uuid := 'ffffffff-0000-0000-0000-000000000006';
  g uuid := '99999999-0000-0000-0000-000000000007';
  v_arroz uuid := (select id from public.recipes where title = 'Arroz salteado con lo que tengas');
  v_cal uuid := (select id from public.recipes where title = 'Calentado con huevo o atún');
  v_plan uuid; opts text[];
begin
  perform tt.login(f);
  perform tt.ok(exists (select 1 from public.eligible_recipes('lunch') where id = v_arroz),
                'f (huevo y pescado) puede comer el arroz: tiene proteínas seguras');
  perform tt.ok(not exists (select 1 from public.eligible_recipes() where id = v_cal),
                'f no recibe una receta cuyo grupo obligatorio solo tiene huevo o atún');
  select array_agg(ingredient_name order by ingredient_name) into opts from public.recipe_flex_menu(v_arroz) where group_key = 1;
  perform tt.ok(not ('Huevo' = any(opts)) and not ('Atún en lata' = any(opts)) and 'Cerdo' = any(opts),
                'el menú de opciones de f oculta huevo y atún');
  perform tt.ok(not exists (select 1 from public.scale_recipe(v_arroz, 4) where ingredient_name in ('Huevo', 'Atún en lata')),
                'la receta resuelta para f no contiene huevo ni atún');
  insert into public.meal_plans (user_id, start_date, end_date) values (f, current_date, current_date + 6) returning id into v_plan;
  perform tt.throws(format($q$ insert into public.planned_meals (plan_id, meal_date, slot, recipe_id, servings) values (%L, current_date, 'lunch', %L, 2) $q$, v_plan, v_cal),
                    'allergen_conflict', 'el trigger rechaza la receta sin opciones seguras');
  perform tt.reset();

  perform tt.login(g);
  perform tt.ok(exists (select 1 from public.eligible_recipes('dinner') where id = v_arroz), 'g (vegana) puede comer el arroz con fríjol');
  perform tt.ok((select array_agg(ingredient_name) from public.scale_recipe(v_arroz, 4) where group_key = 1) = array['Fríjol cocido'],
                'para g la proteína se resuelve con fríjol');
  perform tt.ok(exists (select 1 from public.recipe_diets rd join public.diets d on d.id = rd.diet_id
                        where rd.recipe_id = v_arroz and d.code = 'vegan'),
                'la receta es compatible con vegano porque cada grupo tiene una opción vegana');
  perform tt.reset();

  perform tt.ok((select only_in_options from public.recipe_allergens ra join public.allergens a on a.id = ra.allergen_id
                 where ra.recipe_id = v_arroz and a.code = 'egg'),
                'el huevo figura como alérgeno solo en las opciones, no en la base');
  perform tt.ok((select kcal_per_serving from public.recipe_nutrition where recipe_id = v_arroz) > 0,
                'la nutrición de catálogo se calcula con las opciones por defecto');
end $$;

-- ---- Versátil: se resuelve con lo que hay en la despensa ----------------------
do $$
declare
  h uuid := '88888888-0000-0000-0000-000000000008';
  f uuid := 'ffffffff-0000-0000-0000-000000000006';
  v_arroz uuid := (select id from public.recipes where title = 'Arroz salteado con lo que tengas');
  v_sopa uuid := (select id from public.recipes where title = 'Sopa de lentejas');
  v_g smallint := (select id from public.units where code = 'g');
  v_pollo uuid := (select id from public.ingredients where name = 'Pechuga de pollo');
  v_huevo uuid := (select id from public.ingredients where name = 'Huevo');
  v_plan uuid; v_plan2 uuid; v_pm uuid; v_list uuid; r record; v_n int; v_json jsonb;
begin
  perform tt.login(h);
  perform public.add_to_pantry((select id from public.ingredients where name = 'Cerdo'), 500, v_g);
  perform public.add_to_pantry((select id from public.ingredients where name = 'Habichuela'), 200, v_g, current_date + 2);
  perform public.add_to_pantry((select id from public.ingredients where name = 'Arveja'), 200, v_g);

  perform tt.ok((select array_agg(ingredient_name) from public.scale_recipe(v_arroz, 4) where group_key = 1) = array['Cerdo'],
                'con cerdo en la despensa, la proteína se resuelve con cerdo');
  select array_agg(ingredient_name order by ingredient_name) as n, sum(grams) as g into r from public.scale_recipe(v_arroz, 4) where group_key = 2;
  perform tt.ok(r.n = array['Arveja', 'Habichuela'] and r.g = 150,
                'con dos verduras en la despensa usa ambas, repartiendo la cantidad (75 g + 75 g)');
  perform tt.ok(not exists (select 1 from public.scale_recipe(v_arroz, 4) where group_key = 3),
                'el grupo opcional se omite si no está en la despensa');
  perform tt.ok((select coverage from public.recipe_pantry_match(v_arroz)) > 0.5,
                'la cobertura de despensa cuenta los grupos y los básicos');

  select * into r from public.cook_with_what_i_have('lunch') where recipe_id = v_arroz;
  perform tt.ok(r.recipe_id is not null and r.uses_expiring, '"¿Qué cocino?" propone el arroz y avisa que usa algo por vencer');
  perform tt.ok(r.missing @> '[{"ingredient_name": "Arroz blanco"}]'::jsonb
                and not r.missing @> '[{"ingredient_name": "Sal"}]'::jsonb,
                'lo que falta incluye el arroz y no los básicos (sal, aceite)');

  -- guardar el plan: una sola transacción, con la elección explícita de pollo
  v_plan := public.save_generated_plan(current_date, current_date + 6, jsonb_build_array(
    jsonb_build_object('meal_date', current_date, 'slot', 'lunch', 'recipe_id', v_arroz, 'reason_code', 'pantry_match',
                       'choices', jsonb_build_array(jsonb_build_object('group_key', 1, 'ingredient_id', v_pollo)))));
  v_plan2 := public.save_generated_plan(current_date, current_date + 6, jsonb_build_array(
    jsonb_build_object('meal_date', current_date, 'slot', 'lunch', 'recipe_id', v_arroz,
                       'choices', jsonb_build_array(jsonb_build_object('group_key', 1, 'ingredient_id', v_pollo)))));
  perform tt.ok((select count(*) from public.meal_plans where user_id = h) = 1, 'guardar dos veces el mismo plan deja un solo borrador');
  select id into v_pm from public.planned_meals where plan_id = v_plan2;
  perform tt.ok((select servings from public.planned_meals where id = v_pm) = 4, 'sin porciones explícitas usa el tamaño del hogar');
  perform tt.ok((select array_agg(ingredient_name) from public.scale_planned_meal(v_pm) where group_key = 1) = array['Pechuga de pollo'],
                'la elección explícita gana sobre la despensa');
  perform tt.throws(format($q$ select public.save_generated_plan(current_date, current_date, '[{"meal_date": "%s", "slot": "lunch", "recipe_id": "%s", "choices": [{"group_key": 1, "ingredient_id": "%s"}]}]'::jsonb) $q$,
                           current_date, v_arroz, (select id from public.ingredients where name = 'Arroz blanco')),
                    'foreign key', 'una elección que no es opción de la receta se rechaza (y no queda nada a medias)');
  perform tt.ok((select count(*) from public.meal_plans where user_id = h) = 1, 'el intento fallido no dejó un plan a medias');

  perform tt.throws(format($q$ select public.set_meal_choices(%L, 2::smallint, array(select id from public.ingredients where name in ('Zanahoria','Habichuela','Arveja'))) $q$, v_pm),
                    'too_many_choices', 'no se pueden elegir más opciones que el máximo del grupo');
  perform tt.throws(format($q$ select public.set_meal_choices(%L, 1::smallint, array(select id from public.ingredients where name = 'Arroz blanco')) $q$, v_pm),
                    'foreign key', 'set_meal_choices no acepta ingredientes que no son opción');

  -- presupuesto y compras con las líneas resueltas
  perform tt.ok((select estimated_cost from public.plan_budget_status(v_plan2)) > 0, 'el presupuesto incluye las opciones resueltas');
  v_list := public.generate_shopping_list(v_plan2);
  perform tt.ok((select to_buy_g from public.shopping_list_items where list_id = v_list and ingredient_id = v_pollo) = 300,
                'la lista pide el pollo elegido');
  perform tt.ok(not exists (select 1 from public.shopping_list_items where list_id = v_list
                            and ingredient_id = (select id from public.ingredients where name = 'Cerdo')),
                'y no pide cerdo');
  perform tt.ok((select to_buy_g from public.shopping_list_items where list_id = v_list
                 and ingredient_id = (select id from public.ingredients where name = 'Habichuela')) = 0,
                'la habichuela la cubre la despensa');

  -- cocinar congela la resolución; deshacer la libera
  v_json := public.mark_meal_cooked(v_pm);
  perform tt.ok((select count(*) from public.planned_meal_choices where planned_meal_id = v_pm and is_auto) = 2,
                'al cocinar se fijan las verduras usadas');
  perform tt.ok((select sum(quantity_g) from public.pantry_items where ingredient_id = (select id from public.ingredients where name = 'Habichuela')) = 125,
                'se descontaron 75 g de habichuela');
  perform public.undo_meal_cooked(v_pm);
  perform tt.ok((select count(*) from public.planned_meal_choices where planned_meal_id = v_pm and is_auto) = 0
                and (select count(*) from public.planned_meal_choices where planned_meal_id = v_pm) = 1,
                'deshacer borra lo fijado automáticamente y conserva la elección de la persona');
  perform tt.reset();

  -- RLS: f no ve las elecciones de h
  perform tt.login(f);
  perform tt.ok((select count(*) from public.planned_meal_choices) = 0, 'f no ve las elecciones de h');
  perform tt.throws(format($q$ select * from public.scale_planned_meal(%L) $q$, v_pm), 'meal_not_found', 'f no puede leer la comida de h');
  perform tt.reset();

  -- alergia declarada DESPUÉS de elegir: la elección peligrosa se ignora
  perform tt.login(h);
  perform public.set_meal_choices(v_pm, 1::smallint, array[v_huevo]);
  perform tt.reset();
  insert into public.user_allergens (user_id, allergen_id) select h, id from public.allergens where code = 'egg';
  perform tt.login(h);
  perform tt.ok(not exists (select 1 from public.scale_planned_meal(v_pm) where ingredient_id = v_huevo)
                and exists (select 1 from public.scale_planned_meal(v_pm) where group_key = 1),
                'con alergia nueva al huevo, la comida se resuelve con otra proteína segura');
  perform tt.throws(format($q$ select public.set_meal_choices(%L, 1::smallint, array[%L]::uuid[]) $q$, v_pm, v_huevo),
                    'choice_blocked', 'ya no se puede elegir huevo');

  -- cambiar la receta borra las elecciones de la anterior
  update public.planned_meals set recipe_id = v_sopa where id = v_pm;
  perform tt.ok((select count(*) from public.planned_meal_choices where planned_meal_id = v_pm) = 0,
                'al cambiar de receta se borran las elecciones viejas');
  perform tt.reset();
end $$;

do $$
begin
  perform tt.ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                            where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity),
                'las tablas nuevas también tienen RLS');
end $$;
