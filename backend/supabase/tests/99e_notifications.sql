-- ===================== US-148, US-149, US-153: notificaciones (migración 20261112000200) =====================
do $$
declare
  u uuid := '55555555-0000-0000-0000-000000000148';
  w uuid := '55555555-0000-0000-0000-000000000149';
  v_g smallint := (select id from public.units where code = 'g');
  v_plan uuid; v_meal record; v_n record; v_tomorrow date := (now() at time zone 'America/Bogota')::date + 1;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  select x, e, jsonb_build_object('privacy_policy_document_id', private.latest_legal_document('privacy_policy'),
                                  'terms_document_id', private.latest_legal_document('terms'), 'is_adult', true)
  from (values (u, 'avisos@test.dev'), (w, 'semanal@test.dev')) v(x, e);

  -- sin teléfono registrado no se programa nada
  perform tt.login(u);
  v_plan := public.generate_plan(v_tomorrow, 1);
  perform tt.reset();
  perform private.schedule_notifications();
  perform tt.ok(not exists (select 1 from public.notifications where user_id = u), 'sin teléfono registrado no se programa nada');

  -- registrar el teléfono (y validar el token)
  perform tt.login(u);
  perform tt.throws($q$ select public.register_push_device('cualquier-cosa') $q$, 'invalid_push_token', 'solo se aceptan tokens de Expo');
  perform public.register_push_device('ExponentPushToken[abc123]');
  perform public.add_to_pantry((select id from public.ingredients where name = 'Espinaca'), 300, v_g,
                               ((now() at time zone 'America/Bogota')::date + 2));
  perform tt.reset();

  -- US-148: recordatorio 30 min antes (cena 20:00 → 19:30 hora de Colombia)
  perform private.schedule_notifications();
  select pm.* into v_meal from public.planned_meals pm where pm.plan_id = v_plan and pm.slot = 'dinner';
  perform tt.ok(exists (select 1 from public.notifications where planned_meal_id = v_meal.id
                        and scheduled_for = private.bogota(v_tomorrow, time '19:30')),
                'US-148: la cena de las 20:00 se recuerda a las 19:30 (hora de Colombia)');
  perform private.schedule_notifications();
  perform tt.ok((select count(*) from public.notifications where planned_meal_id = v_meal.id) = 1,
                'US-148: correr la programación otra vez no duplica');

  -- llegó la hora: el mensaje dice la comida y la receta, sin datos de salud
  update public.notifications set scheduled_for = now() - interval '1 minute' where planned_meal_id = v_meal.id;
  select * into v_n from private.due_messages() where notification_id =
    (select id from public.notifications where planned_meal_id = v_meal.id);
  perform tt.ok(v_n.title = 'Tu cena de hoy' and v_n.body = (select title from public.recipes where id = v_meal.recipe_id)
                and v_n.url like '/recipe/%',
                'US-148: "Tu cena de hoy: [receta]" y abre la receta');

  -- caso borde US-148: si ya se cocinó, no se envía
  update public.planned_meals set status = 'cooked', cooked_at = now() where id = v_meal.id;
  perform tt.ok(not exists (select 1 from private.due_messages() where notification_id =
                  (select id from public.notifications where planned_meal_id = v_meal.id)),
                'US-148: lo ya cocinado no se recuerda');

  -- US-153: lo que vence en 2 días, con una receta REAL del catálogo que lo use
  perform tt.ok(exists (select 1 from public.notifications where user_id = u and kind = 'expiry_alert'),
                'US-153: se programa el aviso de lo que vence en 2 días');
  update public.notifications set scheduled_for = now() - interval '1 minute' where user_id = u and kind = 'expiry_alert';
  select * into v_n from private.due_messages() m where m.user_id = u and m.title like 'Usa tu espinaca%';
  perform tt.ok(v_n.body like 'Vence pronto. Prueba: %'
                and exists (select 1 from public.recipes r where v_n.body = 'Vence pronto. Prueba: ' || r.title and r.status = 'published'),
                'US-153: sugiere una receta real del catálogo, no un "cocina algo"');

  -- US-149: "Solo resumen semanal" deja de recibir recordatorios diarios
  perform tt.login(w);
  perform public.register_push_device('ExponentPushToken[semanal1]');
  update public.notification_preferences set frequency = 'weekly_summary' where user_id = w;
  perform public.generate_plan(v_tomorrow, 1);
  perform tt.reset();
  perform private.schedule_notifications();
  perform tt.ok(not exists (select 1 from public.notifications where user_id = w and kind = 'meal_reminder'),
                'US-149: con "Solo resumen semanal" no llegan recordatorios diarios');

  -- el teléfono pasa a quien inicia sesión en él
  perform tt.login(w);
  perform public.register_push_device('ExponentPushToken[abc123]');
  perform tt.reset();
  perform tt.ok((select user_id from public.push_devices where expo_push_token = 'ExponentPushToken[abc123]') = w,
                'el token queda a nombre de quien inició sesión en ese teléfono');

  -- sin configuración de envío, el despacho no hace nada (como en local)
  perform private.dispatch_notifications();
  perform tt.ok(exists (select 1 from public.notifications where sent_at is null), 'sin configurar, no se envía ni se marca');
  perform tt.ok((select count(*) from cron.job where jobname in ('nutriplan-schedule-notifications', 'nutriplan-dispatch-notifications')) = 2,
                'la programación y el envío corren solos');
end $$;
