-- US-122: detectar y corregir fallas, sin servicios externos de monitoreo (decisión del equipo, ADR-026).
-- 1) app_errors: fallas de la app y de las Edge Functions. Solo se escribe; nadie la lee desde la API.
-- 2) Limpieza en la BASE (además de la app): sin correos, tokens, ids ni números largos. Nunca datos de salud.
-- 3) report_app_error: única vía desde la app (también sin sesión: un fallo puede ocurrir antes del login),
--    con límites para que nadie llene la tabla.
-- 4) Panel para el equipo (esquema private, visible en Supabase Studio): fallas por día y por tipo.
-- 5) Alerta: cada 5 minutos pg_cron revisa fallas nuevas y, si las hay, llama a la Edge Function error-alert
--    (correo por Resend). La URL y el secreto se configuran por entorno en private.alert_settings.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create type public.error_source as enum ('app', 'edge');

create table public.app_errors (
  id            bigint generated always as identity primary key,
  occurred_at   timestamptz not null default now(),
  source        public.error_source not null,
  error_name    text not null check (char_length(error_name) between 1 and 120),
  message       text not null check (char_length(message) <= 500),
  stack         text check (char_length(stack) <= 4000),
  screen        text check (char_length(screen) <= 120),
  app_version   text check (char_length(app_version) <= 40),
  device_model  text check (char_length(device_model) <= 80),
  anonymous_id  uuid,
  alerted_at    timestamptz
);
create index app_errors_time_idx on public.app_errors (occurred_at desc);
create index app_errors_pending_alert_idx on public.app_errors (id) where alerted_at is null;
comment on table public.app_errors is
  'US-122: fallas técnicas, sin datos personales ni de salud (se limpian al insertar). Sin user_id a propósito.';

alter table public.app_errors enable row level security;   -- sin políticas: la API no la lee ni la escribe directo
revoke all on public.app_errors from anon, authenticated;

-- ---- Limpieza de texto (también la hace la app; aquí es la red de seguridad) -----------------------
create function private.scrub_error_text(p_text text, p_max integer)
returns text language sql immutable set search_path = '' as $$
  select left(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(coalesce(p_text, ''),
            '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[correo]', 'g'),
          'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)?', '[token]', 'g'),
        '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', '[id]', 'g'),
      '[0-9]{6,}', '[número]', 'g'),
    p_max)
$$;

create function private.scrub_app_error()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.error_name := private.scrub_error_text(new.error_name, 120);
  new.message    := private.scrub_error_text(new.message, 500);
  new.stack      := nullif(private.scrub_error_text(new.stack, 4000), '');
  new.screen     := nullif(private.scrub_error_text(new.screen, 120), '');
  return new;
end $$;

create trigger app_errors_scrub before insert on public.app_errors
  for each row execute function private.scrub_app_error();

-- ---- Reporte desde la app ----------------------------------------------------------------------
create function public.report_app_error(p_error_name text, p_message text, p_stack text default null,
                                        p_screen text default null, p_app_version text default null,
                                        p_device_model text default null, p_anonymous_id uuid default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Límites: 30 por dispositivo y hora; 1000 en total por hora (tope ante abuso o un bucle de errores).
  if p_anonymous_id is not null and (select count(*) from public.app_errors
      where anonymous_id = p_anonymous_id and occurred_at > now() - interval '1 hour') >= 30 then
    return;
  end if;
  if (select count(*) from public.app_errors where occurred_at > now() - interval '1 hour') >= 1000 then
    return;
  end if;
  insert into public.app_errors (source, error_name, message, stack, screen, app_version, device_model, anonymous_id)
  values ('app', coalesce(nullif(trim(p_error_name), ''), 'Error'), coalesce(p_message, ''), p_stack, p_screen,
          left(p_app_version, 40), left(p_device_model, 80), p_anonymous_id);
end $$;

revoke execute on function public.report_app_error(text, text, text, text, text, text, uuid) from public;
grant execute on function public.report_app_error(text, text, text, text, text, text, uuid) to anon, authenticated, service_role;

-- ---- Panel del equipo (Supabase Studio › esquema private) -----------------------------------------
create view private.errors_by_day as
select date_trunc('day', occurred_at at time zone 'America/Bogota')::date as day, source,
       count(*) as errors, count(distinct anonymous_id) as devices
from public.app_errors group by 1, 2 order by 1 desc, 2;

create view private.top_errors_7d as
select source, error_name, left(message, 120) as message, count(*) as times,
       max(occurred_at) as last_seen, count(distinct anonymous_id) as devices
from public.app_errors where occurred_at > now() - interval '7 days'
group by 1, 2, 3 order by times desc;

-- ---- Alerta cada 5 minutos -----------------------------------------------------------------------
create table private.alert_settings (
  id           boolean primary key default true check (id),   -- una sola fila
  function_url text not null,
  secret       text not null
);
comment on table private.alert_settings is
  'Configurar por entorno (no va en el repositorio): URL de la Edge Function error-alert y su secreto (ALERT_SECRET).';

create function private.dispatch_error_alert()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_settings private.alert_settings;
  v_max      bigint;
  v_summary  jsonb;
begin
  select * into v_settings from private.alert_settings;
  if not found then return; end if;                         -- sin configurar (p. ej. en local): no hace nada
  select max(id) into v_max from public.app_errors where alerted_at is null;
  if v_max is null then return; end if;

  select jsonb_build_object(
           'total', count(*),
           'groups', (select jsonb_agg(g) from (
               select source, error_name, left(message, 160) as message, count(*) as times
               from public.app_errors where alerted_at is null and id <= v_max
               group by 1, 2, 3 order by times desc limit 10) g))
    into v_summary
  from public.app_errors where alerted_at is null and id <= v_max;

  perform net.http_post(
    url := v_settings.function_url,
    body := v_summary,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-alert-secret', v_settings.secret));
  update public.app_errors set alerted_at = now() where alerted_at is null and id <= v_max;
end $$;

revoke execute on function private.dispatch_error_alert() from public, anon, authenticated;

select cron.schedule('nutriplan-error-alert', '*/5 * * * *', 'select private.dispatch_error_alert()');
