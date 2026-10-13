-- ===================== Escalado, nutrición, costo, búsqueda =====================
do $$
declare
  v_bowl uuid := (select id from public.recipes where title = 'Bowl de garbanzos y espinaca');
  v_sopa uuid := (select id from public.recipes where title = 'Sopa de lentejas');
  r record; v_base numeric; v_x2 numeric; v_cost record;
begin
  -- lineal: garbanzos 300 g (2 porciones) -> 600 g (4) -> 150 g (1)
  perform tt.ok((select grams from public.scale_recipe(v_bowl, 2) where ingredient_name = 'Garbanzos cocidos') = 300, 'escalado base: 300 g de garbanzos');
  perform tt.ok((select grams from public.scale_recipe(v_bowl, 4) where ingredient_name = 'Garbanzos cocidos') = 600, 'escalado lineal x2: 600 g');
  perform tt.ok((select grams from public.scale_recipe(v_bowl, 1) where ingredient_name = 'Garbanzos cocidos') = 150, 'escalado x0.5: 150 g');
  -- sublineal: la sal (exponente 0.7) crece menos que el doble
  select quantity into v_base from public.scale_recipe(v_sopa, 4) where ingredient_name = 'Sal';
  select quantity into v_x2   from public.scale_recipe(v_sopa, 8) where ingredient_name = 'Sal';
  perform tt.ok(v_x2 > v_base and v_x2 < 2 * v_base, format('la sal escala sublinealmente (%s -> %s tsp)', v_base, v_x2));
  -- redondeo: las cantidades contables salen en múltiplos del paso
  perform tt.ok((select quantity from public.scale_recipe(v_sopa, 6) where ingredient_name = 'Ajo') = 3, 'los dientes de ajo se redondean a enteros');
  perform tt.ok((select count(*) from public.scale_recipe(v_sopa, 4) where quantity <= 0) = 0, 'ninguna cantidad escalada es cero');
  perform tt.throws($q$ select * from public.scale_recipe(gen_random_uuid(), 2) $q$, 'recipe_not_found', 'escalar receta inexistente falla');
  perform tt.throws(format($q$ select * from public.scale_recipe(%L, 0) $q$, v_bowl), 'invalid_servings', 'escalar a 0 porciones falla');

  -- nutrición por porción vs cálculo manual (bowl, 2 porciones)
  -- garbanzos 300 g: 164 kcal/100 g; espinaca 120 g: 23; ajo 8 g: 149;
  -- aceite 2 tbsp = 30 ml * 0.91 = 27.3 g: 884; limón 60 g: 29; comino 5 ml*0.45=2.25 g: 375; sal 0
  select * into r from public.recipe_nutrition where recipe_id = v_bowl;
  perform tt.ok(abs(r.kcal_per_serving - round((3*164 + 1.2*23 + 0.08*149 + 0.273*884 + 0.6*29 + 0.0225*375) / 2, 1)) < 0.2,
                format('kcal por porción coincide con el cálculo manual (%s)', r.kcal_per_serving));
  perform tt.ok(r.ingredients_missing_nutrition = 0, 'no faltan datos nutricionales');

  -- costo: región con precios propios y región con respaldo al país
  select * into v_cost from public.recipe_cost(v_bowl, (select id from public.regions where code = 'CO'));
  perform tt.ok(v_cost.cost > 0 and v_cost.currency_code = 'COP' and v_cost.missing_prices = 0 and v_cost.estimated_prices = 0,
                format('costo en Colombia: %s COP, sin estimados', v_cost.cost));
  select * into v_cost from public.recipe_cost(v_sopa, (select id from public.regions where code = 'CO-NAR-PASTO'));
  perform tt.ok(v_cost.estimated_prices > 0 and v_cost.currency_code = 'COP',
                'en Pasto se usa el precio nacional como respaldo y se marca como estimado');
  perform tt.ok((select price_per_kg from private.ingredient_price(
                   (select id from public.ingredients where name = 'Papa'),
                   (select id from public.regions where code = 'CO-NAR-PASTO'))) = 2200
                and not (select is_estimated from private.ingredient_price(
                   (select id from public.ingredients where name = 'Papa'),
                   (select id from public.regions where code = 'CO-NAR-PASTO'))),
                'el precio propio de Pasto gana sobre el nacional y no es estimado');

  -- búsqueda sin acentos y con errores de tipeo
  perform tt.ok((select count(*) from public.search_ingredients('limon')) >= 1, 'buscar "limon" encuentra "Limón"');
  perform tt.ok((select count(*) from public.search_ingredients('BROCOLI')) >= 1, 'búsqueda insensible a mayúsculas y acentos');
  perform tt.ok((select count(*) from public.search_ingredients('a')) = 0, 'una sola letra no devuelve resultados');
end $$;

-- ===================== Derivaciones: alérgenos y dietas =====================
do $$
declare
  rid uuid;
begin
  select id into rid from public.recipes where title = 'Avena con banano y almendras';
  perform tt.ok(exists (select 1 from public.recipe_allergens ra join public.allergens a on a.id = ra.allergen_id
                        where ra.recipe_id = rid and a.code = 'tree_nuts'), 'la avena hereda "frutos secos" aunque la almendra sea opcional');
  perform tt.ok(exists (select 1 from public.recipe_allergens ra join public.allergens a on a.id = ra.allergen_id
                        where ra.recipe_id = rid and a.code = 'gluten'), 'la avena hereda gluten');
  perform tt.ok(not exists (select 1 from public.recipe_diets rd join public.diets d on d.id = rd.diet_id
                            where rd.recipe_id = rid and d.code = 'gluten_free'), 'avena no es apta para dieta sin gluten');
  perform tt.ok(not exists (select 1 from public.recipe_diets rd join public.diets d on d.id = rd.diet_id
                            where rd.recipe_id = rid and d.code = 'vegan'), 'avena con leche no es vegana');
  select id into rid from public.recipes where title = 'Bowl de garbanzos y espinaca';
  perform tt.ok((select count(*) from public.recipe_diets rd join public.diets d on d.id = rd.diet_id
                 where rd.recipe_id = rid and d.code in ('vegan','vegetarian','gluten_free','lactose_free','low_glycemic')) = 5,
                'el bowl es vegano, vegetariano, sin gluten, sin lactosa y bajo IG (etiqueta curada)');
  select id into rid from public.recipes where title = 'Pollo con arroz y brócoli';
  perform tt.ok(not exists (select 1 from public.recipe_diets rd join public.diets d on d.id = rd.diet_id
                            where rd.recipe_id = rid and d.code = 'vegetarian'), 'el pollo no es vegetariano');
  perform tt.ok((select heat_level from public.recipe_max_heat where recipe_id = rid) = 0,
                'el picante opcional no sube el nivel de picante de la receta');
end $$;

-- ===================== Reglas de publicación =====================
do $$
declare
  rid uuid; v_g smallint := (select id from public.units where code = 'g');
begin
  insert into public.recipes (title, base_servings, prep_minutes) values ('Receta incompleta', 2, 5) returning id into rid;
  perform tt.throws(format($q$ update public.recipes set status = 'published' where id = %L $q$, rid),
                    'recipe_incomplete', 'no se publica una receta sin ingredientes');
  insert into public.recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id)
    values (rid, (select id from public.ingredients where name = 'Espinaca'), 100, v_g);
  perform tt.throws(format($q$ update public.recipes set status = 'published' where id = %L $q$, rid),
                    'recipe_incomplete', 'no se publica una receta sin pasos');
  insert into public.recipe_steps (recipe_id, step_number, instruction) values (rid, 1, 'Lavar.');
  perform tt.throws(format($q$ update public.recipes set status = 'published' where id = %L $q$, rid),
                    'recipe_incomplete', 'no se publica una receta sin tipo de comida');
  insert into public.recipe_meal_slots (recipe_id, slot) values (rid, 'snack');
  perform tt.throws(format($q$ update public.recipes set status = 'published' where id = %L $q$, rid),
                    'review_required', 'receta oficial sin revisión aprobada no se publica');
  insert into public.nutritionist_reviews (recipe_id, reviewer_name, outcome) values (rid, 'Revisora dev', 'approved');
  update public.recipes set status = 'published' where id = rid;
  perform tt.ok((select published_at is not null from public.recipes where id = rid), 'con revisión aprobada se publica y se sella la fecha');
  perform tt.throws(format($q$ update public.recipe_ingredients set quantity = 5 where recipe_id = %L $q$, rid),
                    'recipe_published_locked', 'los ingredientes de una receta publicada están bloqueados');
  perform tt.throws(format($q$ insert into public.recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id)
                               values (%L, (select id from public.ingredients where name = 'Ajo'), 1, %s) $q$, rid,
                    (select id from public.units where code = 'clove')),
                    'recipe_published_locked', 'no se agregan ingredientes a una receta publicada');
  -- un count sin equivalencia en gramos no se puede usar
  perform tt.throws(format($q$ insert into public.recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id)
                               values (%L, (select id from public.ingredients where name = 'Sal'), 1, %s) $q$,
                    (select id from public.recipes where title = 'Receta incompleta'),
                    (select id from public.units where code = 'handful')) , 'unit_incompatible' ,
                    'un ingrediente en una unidad sin equivalencia en gramos se rechaza');
end $$;
