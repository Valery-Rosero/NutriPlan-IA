-- ===================== Alergias propias y lista revisada (migración 20261117000100, US-187, ADR-041) =====================
do $$
declare
  u uuid := '44444444-0000-0000-0000-000000000101';   -- con autorización de datos de salud
  w uuid := '44444444-0000-0000-0000-000000000102';   -- sin autorización
  v_meta jsonb := jsonb_build_object('privacy_policy_document_id', private.latest_legal_document('privacy_policy'),
                                     'terms_document_id', private.latest_legal_document('terms'), 'is_adult', true);
  v_x uuid;          -- el ingrediente que más aparece en las recetas que la persona puede comer
  v_x_name text;
  v_ctx jsonb;
  v_avoid text[];
  v_out jsonb;
begin
  insert into auth.users (id, email, raw_user_meta_data) values (u, 'alergia-u@test.dev', v_meta), (w, 'alergia-w@test.dev', v_meta);

  -- Lista revisada (Codex / rotulado en Colombia)
  perform tt.ok((select name from public.allergens where code = 'soy') = 'Soya', 'se dice "Soya", como en Colombia');
  perform tt.ok(exists (select 1 from public.allergens where code = 'sulfites' and name = 'Sulfitos'), 'la lista incluye "Sulfitos"');

  perform tt.login(u);
  perform public.accept_consent(private.latest_legal_document('sensitive_data_authorization'));

  select ri.ingredient_id into v_x
  from public.eligible_recipes() e join public.recipe_ingredients ri on ri.recipe_id = e.id
  group by ri.ingredient_id order by count(*) desc, ri.ingredient_id limit 1;
  select name into v_x_name from public.ingredients where id = v_x;
  perform tt.ok(v_x is not null, 'antes de la alergia hay recetas con ' || coalesce(v_x_name, '?'));

  -- Una del catálogo y una escrita a mano (no está en el recetario)
  perform public.set_my_custom_allergies(jsonb_build_array(
    jsonb_build_object('label', v_x_name, 'ingredient_id', v_x), jsonb_build_object('label', 'Kiwi')));
  perform tt.ok((select count(*) from public.user_custom_allergies where user_id = u) = 2, 'se guardan las dos alergias propias');

  -- Filtro estricto: ninguna receta elegible la tiene, ni siquiera como opcional
  perform tt.ok(not exists (select 1 from public.eligible_recipes() e join public.recipe_ingredients ri on ri.recipe_id = e.id
                            where ri.ingredient_id = v_x),
                'con la alergia propia, ninguna receta elegible tiene ' || v_x_name || ' (tampoco opcional)');
  perform tt.ok(not exists (select 1 from public.eligible_recipes() e join public.recipe_flex_options o on o.recipe_id = e.id
                            join public.recipe_flex_groups g on g.recipe_id = o.recipe_id and g.group_key = o.group_key
                            where g.min_choices > 0
                              and (select count(*) from public.recipe_flex_options o2
                                   where o2.recipe_id = g.recipe_id and o2.group_key = g.group_key and o2.ingredient_id <> v_x) < g.min_choices),
                'ningún grupo obligatorio queda dependiendo de ese ingrediente');
  perform tt.ok(private.ingredient_blocked_for_user(v_x, u), 'el ingrediente queda bloqueado (sustitutos, opciones, asistente)');
  perform tt.ok(not exists (select 1 from public.assistant_ingredients() where ingredient_id = v_x), 'el asistente no puede usarlo');

  -- La IA: lo evita sin saber por qué, y solo usa ingredientes del catálogo
  v_ctx := public.assistant_profile();
  select array_agg(x) into v_avoid from jsonb_array_elements_text(v_ctx->'avoid') x;
  perform tt.ok('Kiwi' = any(v_avoid) and v_x_name = any(v_avoid), 'la IA recibe las alergias propias en "no usar"');
  perform tt.ok((v_ctx->>'restricted')::boolean, 'con una alergia propia, la IA solo usa ingredientes del catálogo');
  perform tt.ok(position('alerg' in lower(v_ctx::text)) = 0, 'sin la palabra "alergia": qué evitar sí, por qué no');

  -- Validación: sin repetidos, máximo 10, sin textos vacíos
  perform public.set_my_custom_allergies('[{"label": "Kiwi"}, {"label": " kiwi "}, {"label": ""}]'::jsonb);
  perform tt.ok((select count(*) from public.user_custom_allergies where user_id = u) = 1, 'sin repetidos (sin importar mayúsculas) ni vacíos');
  perform tt.throws($q$ select public.set_my_custom_allergies((select jsonb_agg(jsonb_build_object('label', 'Cosa ' || n)) from generate_series(1, 11) n)) $q$,
                    'too_many_custom_allergies', 'máximo 10 alergias propias');
  perform tt.throws($q$ select public.set_my_custom_allergies(jsonb_build_array(jsonb_build_object('label', repeat('a', 41)))) $q$,
                    'check', 'cada alergia propia tiene máximo 40 caracteres');

  -- Exportar mis datos las incluye
  v_out := public.export_my_data();
  perform tt.ok(jsonb_array_length(v_out->'custom_allergies') = 1, 'exportar mis datos incluye las alergias propias');

  -- Nadie más las ve
  perform tt.login(w);
  perform tt.ok(not exists (select 1 from public.user_custom_allergies), 'otra persona no ve las alergias propias (RLS)');
  -- Sin autorización de datos de salud no se pueden guardar
  perform tt.throws($q$ select public.set_my_custom_allergies('[{"label": "Kiwi"}]'::jsonb) $q$,
                    'sensitive_authorization_required', 'sin autorización de datos de salud no se guardan');

  -- Revocar la autorización las borra
  perform tt.login(u);
  perform public.set_my_custom_allergies(jsonb_build_array(jsonb_build_object('label', v_x_name, 'ingredient_id', v_x)));
  perform public.revoke_consent('sensitive_data_authorization');
  perform tt.ok(not exists (select 1 from public.user_custom_allergies where user_id = u), 'al revocar la autorización se borran');
  perform tt.ok(exists (select 1 from public.eligible_recipes() e join public.recipe_ingredients ri on ri.recipe_id = e.id where ri.ingredient_id = v_x),
                'y las recetas con ese ingrediente vuelven');
  perform tt.reset();
end $$;
