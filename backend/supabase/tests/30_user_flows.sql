-- ===================== Recomendación elegible (A: alergia a frutos secos; B: vegetariano) =====================
do $$
declare
  a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  b uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  c uuid := 'cccccccc-0000-0000-0000-000000000003';
  titles text[];
begin
  insert into public.user_consents (user_id, document_id)
    select u, private.latest_legal_document('sensitive_data_authorization') from unnest(array[b, c]) u;   -- A ya la aceptó en la prueba 10
  insert into public.user_allergens (user_id, allergen_id) select a, id from public.allergens where code = 'tree_nuts';
  insert into public.user_diets (user_id, diet_id) select b, id from public.diets where code = 'vegetarian';

  perform tt.login(a);
  select array_agg(title order by title) into titles from public.eligible_recipes();
  perform tt.ok(not ('Avena con banano y almendras' = any(titles)), 'A (alergia a frutos secos) no recibe la avena con almendras opcionales');
  perform tt.ok('Sopa de lentejas' = any(titles) and 'Pollo con arroz y brócoli' = any(titles), 'A sí recibe recetas sin frutos secos');
  perform tt.reset();

  perform tt.login(b);
  select array_agg(title order by title) into titles from public.eligible_recipes();
  perform tt.ok(not ('Pollo con arroz y brócoli' = any(titles)), 'B (vegetariano) no recibe pollo');
  perform tt.ok('Bowl de garbanzos y espinaca' = any(titles), 'B recibe recetas vegetarianas');
  perform tt.ok((select count(*) from public.eligible_recipes('breakfast')) > 0
                and not exists (select 1 from public.eligible_recipes('breakfast') where title like 'Sopa%'), 'el filtro por tipo de comida funciona');
  perform tt.ok(not exists (select 1 from public.eligible_recipes(null, 10)
                            where total_minutes > 10), 'el filtro de minutos máximos se respeta');
  perform tt.reset();

  -- US-137: el tope guardado en el perfil se aplica sin pasarlo (sugerencias de Hoy, plan y alternativas)
  update public.profiles set max_cook_minutes = 10 where id = b;
  perform tt.login(b);
  perform tt.ok(not exists (select 1 from public.eligible_recipes() where total_minutes > 10),
                'US-137: el tiempo máximo del perfil filtra las recetas elegibles');
  perform tt.ok(not exists (select 1 from public.cook_with_what_i_have() s where s.total_minutes > 10),
                'US-137: las sugerencias con lo que tengo respetan el tiempo máximo');
  perform tt.reset();
  update public.profiles set max_cook_minutes = null where id = b;

  -- picante: tolerancia 0 sigue permitiendo el pollo (el ají es opcional)
  update public.profiles set spice_tolerance = 0 where id = c;
  perform tt.login(c);
  perform tt.ok(exists (select 1 from public.eligible_recipes() where title like 'Pollo%'), 'el picante opcional no excluye la receta');
  perform tt.reset();
  -- el ají pasa a ser obligatorio (hay que despublicar para editar): C ya no debe recibirla
  update public.recipes set status = 'draft' where title like 'Pollo%';
  update public.recipe_ingredients set is_optional = false
   where ingredient_id = (select id from public.ingredients where name = 'Ají picante');
  update public.recipes set status = 'published' where title like 'Pollo%';
  perform tt.login(c);
  perform tt.ok(not exists (select 1 from public.eligible_recipes() where title like 'Pollo%'), 'con ají obligatorio y tolerancia 0 la receta se excluye');
  perform tt.reset();
  update public.recipes set status = 'draft' where title like 'Pollo%';
  update public.recipe_ingredients set is_optional = true
   where ingredient_id = (select id from public.ingredients where name = 'Ají picante');
  update public.recipes set status = 'published' where title like 'Pollo%';
  update public.profiles set spice_tolerance = 2 where id = c;
end $$;

-- ===================== Calificación reciente, batch cooking =====================
do $$
declare
  c uuid := 'cccccccc-0000-0000-0000-000000000003';
  v_sopa uuid := (select id from public.recipes where title = 'Sopa de lentejas');
  titles text[];
begin
  insert into public.recipe_ratings (user_id, recipe_id, rating, rated_at) values (c, v_sopa, 1, now() - interval '10 days');
  perform tt.login(c);
  perform tt.ok(not exists (select 1 from public.eligible_recipes() where id = v_sopa), 'receta calificada con 1 estrella hace 10 días no vuelve');
  perform tt.reset();
  update public.recipe_ratings set rated_at = now() - interval '61 days' where user_id = c and recipe_id = v_sopa;
  perform tt.login(c);
  perform tt.ok(exists (select 1 from public.eligible_recipes() where id = v_sopa), 'pasados 60 días la receta vuelve a ser elegible');
  perform tt.reset();

  update public.profiles set batch_cooking = true where id = c;
  perform tt.login(c);
  select array_agg(title) into titles from public.eligible_recipes('dinner');
  perform tt.ok('Sopa de lentejas' = any(titles) and not ('Bowl de garbanzos y espinaca' = any(titles)),
                'con batch cooking en la cena solo salen recetas de 4+ porciones que se conservan');
  perform tt.ok(exists (select 1 from public.eligible_recipes('breakfast')), 'batch cooking no afecta el desayuno');
  perform tt.reset();
  update public.profiles set batch_cooking = false where id = c;
end $$;

-- ===================== Despensa =====================
do $$
declare
  c uuid := 'cccccccc-0000-0000-0000-000000000003';
  v_g smallint := (select id from public.units where code = 'g');
  v_kg smallint := (select id from public.units where code = 'kg');
  v_unit smallint := (select id from public.units where code = 'unit');
  v_hand smallint := (select id from public.units where code = 'handful');
  v_ing uuid := (select id from public.ingredients where name = 'Zanahoria');
  v_garb uuid := (select id from public.ingredients where name = 'Garbanzos cocidos');
  row_ public.pantry_items;
begin
  perform tt.login(c);
  perform public.add_to_pantry(v_garb, 500, v_g, current_date + 3);
  row_ := public.add_to_pantry(v_garb, 0.5, v_kg, current_date + 3);
  perform tt.ok(row_.quantity_g = 1000, 'mismo ingrediente y vencimiento se fusionan en un lote (500 g + 0.5 kg = 1000 g)');
  perform public.add_to_pantry(v_garb, 200, v_g, current_date + 10);
  perform public.add_to_pantry(v_garb, 100, v_g, null);
  perform tt.ok((select count(*) from public.pantry_items where ingredient_id = v_garb) = 3, 'vencimientos distintos (y sin vencimiento) son lotes separados');
  row_ := public.add_to_pantry(v_ing, 3, v_unit);
  perform tt.ok(row_.quantity_g = 240, '3 zanahorias = 240 g usando su peso por unidad');
  perform tt.throws(format($q$ select public.add_to_pantry(%L::uuid, 1, %s::smallint) $q$, v_ing, v_hand), 'unit_incompatible', 'unidad sin equivalencia en gramos se rechaza');
  perform tt.throws(format($q$ select public.add_to_pantry(%L::uuid, -5, %s::smallint) $q$, v_ing, v_g), 'invalid_quantity', 'cantidad negativa se rechaza');
  perform tt.ok((select count(*) from public.recipes_using_expiring_ingredients(5)) > 0, 'sugiere recetas que usan ingredientes por vencer');
  perform tt.ok((select coverage from public.recipe_pantry_match((select id from public.recipes where title = 'Sopa de lentejas'))) > 0, 'cobertura de despensa de una receta');
  perform tt.reset();
end $$;
