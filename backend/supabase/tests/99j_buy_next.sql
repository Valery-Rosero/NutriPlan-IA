-- ===================== Qué comprar para completar recetas (migración 20261114000200, ADR-030) =====================
do $$
declare
  u uuid := '44444444-0000-0000-0000-000000000071';
  v_meta jsonb := jsonb_build_object('privacy_policy_document_id', private.latest_legal_document('privacy_policy'),
                                     'terms_document_id', private.latest_legal_document('terms'), 'is_adult', true);
  v_target record;
  v_last uuid;
  v_title text;
begin
  insert into auth.users (id, email, raw_user_meta_data) values (u, 'compra-siguiente@test.dev', v_meta);
  update public.profiles set region_id = (select id from public.regions where code = 'CO-NAR-PASTO') where id = u;
  insert into public.user_consents (user_id, document_id) values (u, private.latest_legal_document('sensitive_data_authorization'));
  insert into public.user_allergens (user_id, allergen_id) select u, id from public.allergens where code = 'egg';
  perform tt.login(u);

  -- Una receta segura a la que le falten 2 o más cosas: se compra todo menos una.
  select c.recipe_id, c.title, c.missing into v_target
  from public.cook_with_what_i_have(null, null, 50) c where c.missing_count >= 2 order by c.title limit 1;
  v_title := v_target.title;
  v_last := (v_target.missing -> -1 ->> 'ingredient_id')::uuid;
  perform tt.reset();
  insert into public.pantry_items (user_id, ingredient_id, quantity_g)
  select u, (x ->> 'ingredient_id')::uuid, 5000 from jsonb_array_elements(v_target.missing) x
  where (x ->> 'ingredient_id')::uuid <> v_last;
  perform tt.login(u);

  perform tt.ok(exists (select 1 from public.what_to_buy_next(10) w where w.ingredient_id = v_last and w.completes >= 1 and v_title = any (w.recipes)),
                'sugiere justo lo que le falta a una receta casi completa, y dice qué receta completa');
  perform tt.ok((select coalesce(bool_and(w.completes <= w.helps), true) from public.what_to_buy_next(10) w),
                'cuenta aparte las recetas que completa y en las que ayuda');
  perform tt.ok(not exists (select 1 from public.what_to_buy_next(10) w where private.ingredient_blocked_for_user(w.ingredient_id, u)),
                'nunca sugiere comprar algo que la persona no puede comer');
  perform tt.ok((select count(*) from public.what_to_buy_next(2)) <= 2, 'respeta el límite pedido');
  perform tt.reset();

  perform tt.anon();
  perform tt.throws($q$ select * from public.what_to_buy_next(3) $q$, 'permission denied', 'sin sesión no se puede consultar');
  perform tt.reset();
  delete from auth.users where id = u;
end $$;
