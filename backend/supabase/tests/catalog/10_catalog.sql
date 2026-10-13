-- ===================== Catálogo real: integridad y seguridad alimentaria =====================
-- Corre sobre la base con catalog/*.sql (sin datos de prueba). Es la "prueba de contenido" del plan:
-- ninguna receta publicada pone en riesgo perfiles con restricciones y todos comen en cada momento del día.

do $$
declare
  v_slots public.meal_slot[] := array['breakfast', 'lunch', 'dinner', 'snack'];
  s public.meal_slot;
  r record;
begin
  perform tt.ok((select count(*) from public.recipes where status = 'published') >= 16, 'el catálogo publica al menos 16 recetas');
  perform tt.ok(not exists (select 1 from public.ingredients where allergens_reviewed_at is null),
                'todos los ingredientes del catálogo tienen los alérgenos revisados');
  perform tt.ok(not exists (select 1 from public.recipe_nutrition where kcal_per_serving is null or ingredients_missing_nutrition > 0),
                'todas las recetas tienen nutrición calculable');
  perform tt.ok((select count(*) from public.recipes rc where exists (select 1 from public.recipe_flex_groups g where g.recipe_id = rc.id))
                = (select count(*) from public.recipes), 'todas las recetas son versátiles (tienen grupos intercambiables)');
  perform tt.ok(not exists (select 1 from public.recipe_nutrition where kcal_per_serving > 1500),
                'ninguna porción supera 1500 kcal (detecta cantidades mal escritas)');

  -- el escalado funciona en todas las recetas y tamaños de hogar
  for r in select id from public.recipes loop
    perform count(*) from public.scale_recipe(r.id, 1);
    perform count(*) from public.scale_recipe(r.id, 8);
  end loop;
  perform tt.ok(true, 'todas las recetas escalan de 1 a 8 porciones');

  -- perfiles de prueba
  insert into auth.users (id, email, raw_user_meta_data)
  select u.id, u.email, jsonb_build_object('privacy_policy_document_id', private.latest_legal_document('privacy_policy'),
                                           'terms_document_id', private.latest_legal_document('terms'), 'is_adult', true)
  from (values ('a0000000-0000-4000-8000-00000000000a'::uuid, 'libre@test.dev'),
               ('b0000000-0000-4000-8000-00000000000b'::uuid, 'vegana@test.dev'),
               ('c0000000-0000-4000-8000-00000000000c'::uuid, 'alergias@test.dev')) u(id, email);
  insert into public.user_consents (user_id, document_id)
  select u, private.latest_legal_document('sensitive_data_authorization')
  from unnest(array['b0000000-0000-4000-8000-00000000000b', 'c0000000-0000-4000-8000-00000000000c']::uuid[]) u;
  insert into public.user_diets (user_id, diet_id)
  select 'b0000000-0000-4000-8000-00000000000b', id from public.diets where code = 'vegan';
  insert into public.user_allergens (user_id, allergen_id)
  select 'c0000000-0000-4000-8000-00000000000c', id from public.allergens where code in ('egg', 'milk', 'gluten', 'fish');

  foreach s in array v_slots loop
    perform tt.login('a0000000-0000-4000-8000-00000000000a');
    perform tt.ok((select count(*) from public.eligible_recipes(s)) >= 3, format('sin restricciones hay ≥ 3 recetas para %s', s));
    perform tt.login('b0000000-0000-4000-8000-00000000000b');
    perform tt.ok((select count(*) from public.eligible_recipes(s)) >= 2, format('una persona vegana tiene ≥ 2 recetas para %s', s));
    perform tt.ok(not exists (select 1 from public.eligible_recipes(s) e, public.scale_recipe(e.id, 4) l
                              join public.ingredients i on i.id = l.ingredient_id
                              join public.food_groups g on g.id = i.food_group_id
                              where g.code in ('red_meat', 'poultry', 'fish', 'shellfish', 'dairy', 'egg', 'honey')),
                  format('a la persona vegana nunca se le resuelve un ingrediente animal (%s)', s));
    perform tt.login('c0000000-0000-4000-8000-00000000000c');
    perform tt.ok((select count(*) from public.eligible_recipes(s)) >= 2,
                  format('con alergia a huevo, leche, gluten y pescado hay ≥ 2 recetas para %s', s));
    perform tt.ok(not exists (select 1 from public.eligible_recipes(s) e, public.scale_recipe(e.id, 4) l
                              join public.ingredient_allergens ia on ia.ingredient_id = l.ingredient_id
                              join public.user_allergens ua on ua.allergen_id = ia.allergen_id
                              where ua.user_id = 'c0000000-0000-4000-8000-00000000000c'),
                  format('nunca se le resuelve un ingrediente con sus alérgenos (%s)', s));
    perform tt.reset();
  end loop;
end $$;
