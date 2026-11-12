-- US-148 (recordatorio de la próxima comida), US-149 (frecuencia) y US-153 (por vencer, con receta real).
-- La base decide QUÉ y CUÁNDO (probado en SQL); la Edge Function send-notifications solo entrega por Expo Push.
-- 1) Horas de referencia por momento del día (hora de Colombia): desayuno 7:00, almuerzo 12:30, algo 16:00, cena 20:00.
-- 2) private.schedule_notifications (pg_cron cada 15 min) crea las filas en notifications, sin duplicar
--    (unicidades de la tabla), respetando notification_preferences y solo para quien tiene un teléfono registrado.
-- 3) private.dispatch_notifications (pg_cron cada 5 min) arma los mensajes de lo que ya toca, descarta lo que dejó
--    de aplicar (la comida ya se cocinó u omitió, el ingrediente se acabó) y llama a send-notifications.
-- Los textos nunca llevan datos de salud: solo el momento del día, el nombre de la receta o del ingrediente.

create function private.slot_time(p_slot public.meal_slot)
returns time language sql immutable set search_path = '' as $$
  select case p_slot when 'breakfast' then time '07:00' when 'lunch' then time '12:30'
                     when 'snack' then time '16:00' else time '20:00' end
$$;

-- Hora de Colombia → instante (America/Bogota no tiene horario de verano).
create function private.bogota(p_day date, p_time time)
returns timestamptz language sql immutable set search_path = '' as $$
  select (p_day + p_time) at time zone 'America/Bogota'
$$;

create function private.schedule_notifications()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'America/Bogota')::date;
begin
  -- US-148: recordatorio antes de cada comida pendiente de hoy y mañana (solo frecuencia diaria)
  insert into public.notifications (user_id, kind, planned_meal_id, scheduled_for)
  select mp.user_id, 'meal_reminder', pm.id,
         private.bogota(pm.meal_date, private.slot_time(pm.slot)) - make_interval(mins => np.meal_reminder_lead_minutes)
  from public.planned_meals pm
  join public.meal_plans mp on mp.id = pm.plan_id and mp.status <> 'archived'
  join public.notification_preferences np on np.user_id = mp.user_id and np.frequency = 'daily'
  where pm.status = 'planned' and pm.meal_date between v_today and v_today + 1
    and exists (select 1 from public.push_devices d where d.user_id = mp.user_id)
    and private.bogota(pm.meal_date, private.slot_time(pm.slot)) - make_interval(mins => np.meal_reminder_lead_minutes) > now()
  on conflict do nothing;

  -- US-153: lo que vence en 2 días o menos, a las 9:00, solo si hay una receta real y segura que lo use
  insert into public.notifications (user_id, kind, pantry_item_id, scheduled_for)
  select pi.user_id, 'expiry_alert', pi.id, greatest(private.bogota(v_today, time '09:00'), now())
  from public.pantry_items pi
  join public.notification_preferences np on np.user_id = pi.user_id
       and np.frequency <> 'none' and np.expiry_alerts_enabled
  where pi.quantity_g > 0 and pi.expires_on between v_today and v_today + 2
    and exists (select 1 from public.push_devices d where d.user_id = pi.user_id)
    and exists (select 1 from private.expiry_recipe(pi.ingredient_id, pi.user_id))
  on conflict do nothing;

  -- US-149: resumen semanal los domingos a las 18:00 para quien eligió "Solo resumen semanal"
  if extract(isodow from v_today) = 7 then
    insert into public.notifications (user_id, kind, scheduled_for)
    select np.user_id, 'weekly_summary', private.bogota(v_today, time '18:00')
    from public.notification_preferences np
    where np.frequency = 'weekly_summary'
      and exists (select 1 from public.push_devices d where d.user_id = np.user_id)
    on conflict do nothing;
  end if;
end $$;

-- Una receta publicada, real y segura (alergias y dietas) que use el ingrediente en la base o como opción.
create function private.expiry_recipe(p_ingredient_id uuid, p_user_id uuid)
returns table (recipe_id uuid, title text) language sql stable security definer set search_path = '' as $$
  select r.id, r.title
  from public.recipes r
  where r.status = 'published'
    and not private.recipe_blocked_for_user(r.id, p_user_id)
    and (exists (select 1 from public.recipe_ingredients ri where ri.recipe_id = r.id and ri.ingredient_id = p_ingredient_id)
         or exists (select 1 from public.recipe_flex_options o where o.recipe_id = r.id and o.ingredient_id = p_ingredient_id))
  order by exists (select 1 from public.recipe_ingredients ri
                   where ri.recipe_id = r.id and ri.ingredient_id = p_ingredient_id and not ri.is_optional) desc, r.title
  limit 1
$$;

-- Mensajes de lo que ya toca enviar. Lo que dejó de aplicar se marca como resuelto sin enviarse.
create function private.due_messages()
returns table (notification_id bigint, user_id uuid, title text, body text, url text)
language plpgsql security definer set search_path = '' as $$
begin
  -- Caso borde US-148: si ya se cocinó u omitió, no se envía. US-153: si el ingrediente se acabó, tampoco.
  update public.notifications n set sent_at = now()
  where n.sent_at is null and n.scheduled_for <= now()
    and ((n.kind = 'meal_reminder' and not exists (select 1 from public.planned_meals pm where pm.id = n.planned_meal_id and pm.status = 'planned'))
      or (n.kind = 'expiry_alert' and not exists (select 1 from public.pantry_items pi where pi.id = n.pantry_item_id and pi.quantity_g > 0)));

  return query
  select n.id, n.user_id,
         case n.kind
           when 'meal_reminder'  then 'Tu ' || case pm.slot when 'breakfast' then 'desayuno' when 'lunch' then 'almuerzo'
                                                         when 'snack' then 'algo' else 'cena' end || ' de hoy'
           when 'expiry_alert'   then 'Usa tu ' || lower(i.name) || ' antes de que se dañe'
           else 'Tu semana en NutriPlan' end,
         case n.kind
           when 'meal_reminder'  then r.title
           when 'expiry_alert'   then 'Vence pronto. Prueba: ' || er.title
           else 'Organiza tu semana y arma la lista de mercado con lo que tienes.' end,
         case n.kind
           when 'meal_reminder'  then '/recipe/' || pm.recipe_id || '?mealId=' || pm.id || '&servings=' || pm.servings
           when 'expiry_alert'   then '/recipe/' || er.recipe_id
           else '/week' end
  from public.notifications n
  left join public.planned_meals pm on pm.id = n.planned_meal_id
  left join public.recipes r on r.id = pm.recipe_id
  left join public.pantry_items pi on pi.id = n.pantry_item_id
  left join public.ingredients i on i.id = pi.ingredient_id
  left join lateral private.expiry_recipe(pi.ingredient_id, pi.user_id) er on n.kind = 'expiry_alert'
  where n.sent_at is null and n.scheduled_for <= now()
    and (n.kind <> 'expiry_alert' or er.recipe_id is not null)
  order by n.scheduled_for
  limit 500;
end $$;

create table private.push_settings (
  id           boolean primary key default true check (id),   -- una sola fila
  function_url text not null,
  secret       text not null
);
comment on table private.push_settings is
  'Configurar por entorno (no va en el repositorio): URL de la Edge Function send-notifications y su secreto (PUSH_SECRET).';

create function private.dispatch_notifications()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_settings private.push_settings;
  v_messages jsonb;
begin
  select * into v_settings from private.push_settings;
  if not found then return; end if;                       -- sin configurar (p. ej. en local): no envía

  select jsonb_agg(jsonb_build_object('to', d.expo_push_token, 'title', m.title, 'body', m.body,
                                      'data', jsonb_build_object('url', m.url), 'notification_id', m.notification_id))
    into v_messages
  from private.due_messages() m
  join public.push_devices d on d.user_id = m.user_id;

  if v_messages is null then return; end if;
  perform net.http_post(
    url := v_settings.function_url,
    body := jsonb_build_object('messages', v_messages),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_settings.secret));
  update public.notifications set sent_at = now()
  where id in (select (x ->> 'notification_id')::bigint from jsonb_array_elements(v_messages) x);
end $$;

-- ---- Registro del teléfono (la app lo llama al activar las notificaciones) -------------------------
-- Un token pertenece a UN teléfono: si otra persona inicia sesión en ese teléfono, el token pasa a ella
-- (security definer: la fila anterior era de otra cuenta y RLS no dejaría moverla).
create function public.register_push_device(p_token text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$' then
    raise exception 'invalid_push_token' using errcode = '22023';
  end if;
  insert into public.push_devices (user_id, expo_push_token, platform) values (v_user, p_token, 'android')
  on conflict (expo_push_token) do update set user_id = excluded.user_id, last_seen_at = now();
end $$;

create function public.unregister_push_device(p_token text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_devices where expo_push_token = p_token and user_id = (select auth.uid())
$$;

revoke execute on function public.register_push_device(text), public.unregister_push_device(text) from public, anon;
grant execute on function public.register_push_device(text), public.unregister_push_device(text) to authenticated, service_role;

revoke execute on function private.schedule_notifications(), private.dispatch_notifications(), private.due_messages(),
  private.expiry_recipe(uuid, uuid) from public, anon, authenticated;

select cron.schedule('nutriplan-schedule-notifications', '*/15 * * * *', 'select private.schedule_notifications()');
select cron.schedule('nutriplan-dispatch-notifications', '*/5 * * * *', 'select private.dispatch_notifications()');
