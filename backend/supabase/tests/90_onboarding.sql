-- ===================== Sprint 2: onboarding y despensa (migración 20261014000100) =====================
do $$
declare
  o uuid := '77777777-0000-0000-0000-000000000009';
  v_egg smallint := (select id from public.allergens where code = 'egg');
  v_milk smallint := (select id from public.allergens where code = 'milk');
  v_veg smallint := (select id from public.diets where code = 'vegetarian');
  v_lb smallint := (select id from public.units where code = 'lb');
  r public.pantry_items;
begin
  insert into auth.users (id, email, raw_user_meta_data) values (o, 'o@test.dev',
    jsonb_build_object('privacy_policy_document_id', private.latest_legal_document('privacy_policy'),
                       'terms_document_id', private.latest_legal_document('terms'), 'is_adult', true));

  perform tt.login(o);
  perform tt.throws(format($q$ select public.set_my_restrictions(array[%s]::smallint[], '{}') $q$, v_egg),
                    'sensitive_authorization_required', 'sin autorización de datos sensibles no se guardan alergias');
  perform public.set_my_restrictions('{}', '{}');
  perform tt.ok(true, 'sin autorización sí se puede dejar todo vacío (omitir el paso)');

  perform public.accept_consent(private.latest_legal_document('sensitive_data_authorization'));
  perform public.set_my_restrictions(array[v_egg, v_milk], array[v_veg]);
  perform tt.ok((select count(*) from public.user_allergens) = 2 and (select count(*) from public.user_diets) = 1,
                'guarda alergias y dieta en una sola llamada');
  perform public.set_my_restrictions(array[v_milk], '{}');
  perform tt.ok((select array_agg(allergen_id) from public.user_allergens) = array[v_milk]
                and not exists (select 1 from public.user_diets),
                'reemplaza el conjunto: quita lo que ya no viene');

  -- despensa en libras
  r := public.add_to_pantry((select id from public.ingredients where name = 'Papa'), 2, v_lb);
  perform tt.ok(r.quantity_g = 1000, '2 libras de papa = 1000 g');

  update public.profiles set household_size = 5, onboarding_completed_at = now(),
         region_id = (select id from public.regions where code = 'CO-NAR-PASTO') where id = o;
  perform tt.ok((select household_size = 5 and onboarding_completed_at is not null from public.profiles where id = o),
                'la persona actualiza su hogar, región y fin del onboarding');
  perform tt.reset();
end $$;
