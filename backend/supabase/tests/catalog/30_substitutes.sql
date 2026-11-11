-- ===================== Catálogo real: sustitutos (US-147, migración 20261015000200) =====================
-- Usa el perfil libre de 10_catalog.sql, que ya tiene un plan de 20_plans.sql.
do $$
declare
  u uuid := 'a0000000-0000-4000-8000-00000000000a';
  v_plan uuid; v_list uuid;
  v_item record; v_sub record;
begin
  perform tt.ok((select count(*) from public.ingredient_substitutions) >= 20, 'US-147: el catálogo trae sustitutos');

  perform tt.login(u);
  v_plan := (select id from public.meal_plans where user_id = u and status = 'draft' order by created_at desc limit 1);
  v_list := public.generate_shopping_list(v_plan);

  -- un ítem del plan que tenga sustituto
  select sli.id, sli.ingredient_id into v_item
  from public.shopping_list_items sli
  where sli.list_id = v_list and sli.source = 'plan'
    and exists (select 1 from public.suggest_substitutes_for(array[sli.ingredient_id]))
  limit 1;
  perform tt.ok(v_item.id is not null, 'US-147: la lista del plan tiene ingredientes con sustituto');

  select * into v_sub from public.suggest_substitutes_for(array[v_item.ingredient_id]) limit 1;
  perform public.substitute_shopping_item(v_item.id, v_sub.substitute_id);
  perform tt.ok(not exists (select 1 from public.shopping_list_items where list_id = v_list and ingredient_id = v_item.ingredient_id),
                'US-147: al sustituir, el original sale de la lista');
  perform tt.ok(exists (select 1 from public.my_shopping_items where list_id = v_list and ingredient_id = v_sub.substitute_id
                                                         and replaces_name is not null),
                'US-147: el sustituto entra a la lista y dice a quién reemplaza');

  perform public.generate_shopping_list(v_plan);
  perform tt.ok(not exists (select 1 from public.shopping_list_items where list_id = v_list and ingredient_id = v_item.ingredient_id),
                'US-147: "Actualizar desde el plan" respeta la sustitución');

  perform public.undo_shopping_substitution(
    (select id from public.shopping_list_items where list_id = v_list and ingredient_id = v_sub.substitute_id));
  perform tt.ok(exists (select 1 from public.shopping_list_items where list_id = v_list and ingredient_id = v_item.ingredient_id),
                'US-147: deshacer devuelve el ingrediente original');

  perform tt.throws($q$ select public.substitute_shopping_item(
                          (select id from public.shopping_list_items limit 1), (select id from public.ingredients where name = 'Sal')) $q$,
                    'not_substitutable', 'US-147: no se acepta un "sustituto" que no está en el catálogo');
  perform tt.reset();

  -- alergias: el perfil con alergias no recibe sustitutos que las contengan
  perform tt.login('c0000000-0000-4000-8000-00000000000c');
  perform tt.ok(not exists (
                  select 1 from public.suggest_substitutes_for(array(select id from public.ingredients)) s
                  join public.ingredient_allergens ia on ia.ingredient_id = s.substitute_id
                  join public.user_allergens ua on ua.allergen_id = ia.allergen_id
                  where ua.user_id = 'c0000000-0000-4000-8000-00000000000c'),
                'US-147: nunca se sugiere un sustituto con un alérgeno declarado');
  perform tt.ok(exists (select 1 from public.suggest_substitutes_for(array(select id from public.ingredients))),
                'US-147: con alergias igual recibe los sustitutos que sí puede comer');
  -- salvaguarda: aunque inserte a mano una sustitución con su alérgeno (leche), la lista la ignora
  v_plan := (select id from public.meal_plans where user_id = 'c0000000-0000-4000-8000-00000000000c'
               and status = 'draft' order by created_at desc limit 1);
  v_list := public.generate_shopping_list(v_plan);
  insert into public.shopping_list_substitutions (list_id, ingredient_id, substitute_id, ratio)
  select v_list, sli.ingredient_id, (select id from public.ingredients where name = 'Queso campesino'), 1
  from public.shopping_list_items sli where sli.list_id = v_list and sli.source = 'plan' limit 1;
  perform public.generate_shopping_list(v_plan);
  perform tt.ok(not exists (select 1 from public.shopping_list_items sli join public.ingredients i on i.id = sli.ingredient_id
                            where sli.list_id = v_list and i.name = 'Queso campesino'),
                'US-147: una sustitución con un alérgeno declarado nunca llega a la lista');
  perform tt.reset();
end $$;
