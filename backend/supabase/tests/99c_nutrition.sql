-- ===================== US-159 (Mi día) y US-136 (objetivo de proteína) — migración 20261111000200 =====================
do $$
declare
  u uuid := '55555555-0000-0000-0000-000000000159';
  v_bowl uuid := (select id from public.recipes where title = 'Bowl de garbanzos y espinaca');
  v_cook jsonb; v_plan uuid; v_fits boolean;
begin
  insert into auth.users (id, email, raw_user_meta_data) values (u, 'midia@test.dev',
    jsonb_build_object('privacy_policy_document_id', private.latest_legal_document('privacy_policy'),
                       'terms_document_id', private.latest_legal_document('terms'), 'is_adult', true));

  -- metas: datos sensibles
  perform tt.login(u);
  perform tt.throws(format($q$ update public.profiles set target_protein_pct = 30 where id = %L $q$, u),
                    'sensitive_authorization_required', 'US-136: sin autorización de datos sensibles no se guarda la meta de proteína');
  perform tt.throws(format($q$ update public.profiles set daily_kcal_target = 2000 where id = %L $q$, u),
                    'sensitive_authorization_required', 'US-159: sin autorización no se guarda la meta de calorías');
  perform tt.reset();

  insert into public.user_consents (user_id, document_id) values (u, private.latest_legal_document('sensitive_data_authorization'));
  perform tt.login(u);
  update public.profiles set target_protein_pct = 40, daily_kcal_target = 2000 where id = u;
  perform tt.ok((select target_protein_pct = 40 and daily_kcal_target = 2000 from public.profiles where id = u),
                'US-136: con autorización se guardan las metas');
  perform tt.throws(format($q$ update public.profiles set target_protein_pct = 60 where id = %L $q$, u),
                    'check', 'US-136: la proteína va de 10 % a 50 %');

  -- Mi día: lo cocinado cuenta; lo pendiente se lista aparte; lo omitido no aparece
  v_cook := public.cook_now(v_bowl, 'lunch', 2);
  v_plan := public.generate_plan(current_date, 1);
  perform tt.ok(exists (select 1 from public.daily_nutrition() where status = 'cooked' and title = 'Bowl de garbanzos y espinaca' and kcal > 0),
                'US-159: la comida cocinada hoy aparece con sus kcal por porción');
  perform tt.ok(exists (select 1 from public.daily_nutrition() where status = 'planned'),
                'US-159: las comidas pendientes aparecen como pendientes');
  update public.planned_meals set status = 'skipped'
   where id = (select planned_meal_id from public.daily_nutrition() where status = 'planned' limit 1);
  perform tt.ok(not exists (select 1 from public.daily_nutrition() d join public.planned_meals pm on pm.id = d.planned_meal_id
                            where pm.status = 'skipped'), 'US-159: lo omitido no cuenta');
  perform tt.ok((select count(*) from public.daily_nutrition() where status = 'cooked') = 1,
                'US-159: no se duplica lo cocinado al generar un plan nuevo para hoy');

  -- US-136: si alguna receta elegible encaja con la meta, el plan la prefiere y lo dice
  select exists (select 1 from public.eligible_recipes() e join public.recipe_nutrition n on n.recipe_id = e.id
                 where n.kcal_per_serving > 0 and n.protein_g_per_serving * 400 / n.kcal_per_serving >= 35) into v_fits;
  v_plan := public.generate_plan(current_date + 1, 3);
  perform tt.ok(not v_fits or exists (select 1 from public.planned_meals where plan_id = v_plan and reason_code = 'macro_fit'),
                'US-136: con meta de proteína, el plan sube lo que encaja (motivo macro_fit)');
  perform tt.reset();

  -- revocar borra las metas
  perform tt.login(u);
  perform public.revoke_consent('sensitive_data_authorization');
  perform tt.ok((select target_protein_pct is null and daily_kcal_target is null from public.profiles where id = u),
                'US-136: al revocar la autorización se borran las metas');
  perform tt.reset();
end $$;
