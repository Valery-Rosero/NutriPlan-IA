-- =============================================================================
-- 0007 · Valoraciones, comunidad, soporte, asistente de IA, notificaciones, analítica
-- =============================================================================

-- ---- Valoraciones -----------------------------------------------------------
create table public.recipe_ratings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  recipe_id       uuid not null references public.recipes(id)  on delete cascade,
  planned_meal_id uuid unique references public.planned_meals(id) on delete set null,
  rating          smallint not null check (rating between 1 and 5),
  comment         varchar(200),
  rated_at        timestamptz not null default now()
);
create index recipe_ratings_user_recipe_idx on public.recipe_ratings (user_id, recipe_id, rated_at desc);
create index recipe_ratings_recipe_idx      on public.recipe_ratings (recipe_id);
comment on table public.recipe_ratings is 'Historial: cada vez que se cocina y califica queda una fila (receta + usuario + fecha).';

create table public.recipe_rating_tag_links (
  rating_id uuid     not null references public.recipe_ratings(id) on delete cascade,
  tag_id    smallint not null references public.rating_tags(id),
  primary key (rating_id, tag_id)
);

-- La comida calificada debe ser del mismo usuario y de la misma receta.
create function private.validate_rating()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_recipe uuid;
begin
  if new.planned_meal_id is not null then
    select p.user_id, pm.recipe_id into v_owner, v_recipe
    from public.planned_meals pm join public.meal_plans p on p.id = pm.plan_id
    where pm.id = new.planned_meal_id;
    if v_owner is distinct from new.user_id or v_recipe is distinct from new.recipe_id then
      raise exception 'rating_mismatch: la comida no pertenece a este usuario o a esta receta' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger recipe_ratings_validate before insert or update of user_id, recipe_id, planned_meal_id
  on public.recipe_ratings for each row execute function private.validate_rating();

-- Solo agregados: se ejecuta con los permisos del dueño de la vista a propósito, para mostrar el promedio
-- de la comunidad sin exponer las valoraciones individuales (que RLS reserva a cada usuario).
create view public.recipe_rating_stats with (security_invoker = false) as
select recipe_id, round(avg(rating), 2) as avg_rating, count(*)::int as ratings_count
from public.recipe_ratings
group by recipe_id;

-- ---- Comunidad --------------------------------------------------------------
create table public.recipe_comments (
  id         uuid primary key default gen_random_uuid(),
  recipe_id  uuid not null references public.recipes(id)  on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  hidden_at  timestamptz,
  created_at timestamptz not null default now()
);
create index recipe_comments_recipe_idx on public.recipe_comments (recipe_id, created_at);

create function private.require_community_consent()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not private.has_consent(new.user_id, 'community_sharing') then
    raise exception 'consent_required: acepta compartir en la comunidad antes de publicar' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger recipe_comments_consent before insert on public.recipe_comments
  for each row execute function private.require_community_consent();

create table public.content_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  comment_id  uuid references public.recipe_comments(id) on delete cascade,
  recipe_id   uuid references public.recipes(id)         on delete cascade,
  reason      public.report_reason not null,
  details     varchar(500),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  check ((comment_id is null) <> (recipe_id is null)),     -- arco exclusivo: reporta un comentario O una receta
  unique (reporter_id, comment_id),
  unique (reporter_id, recipe_id)
);
create index content_reports_comment_idx on public.content_reports (comment_id) where comment_id is not null;
create index content_reports_recipe_idx  on public.content_reports (recipe_id)  where recipe_id  is not null;

-- 3 reportes de usuarios distintos ocultan el comentario o devuelven la receta a revisión.
create function private.auto_moderate_on_report()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.comment_id is not null
     and (select count(distinct reporter_id) from public.content_reports where comment_id = new.comment_id) >= 3 then
    update public.recipe_comments set hidden_at = coalesce(hidden_at, now()) where id = new.comment_id;
  end if;
  if new.recipe_id is not null
     and (select count(distinct reporter_id) from public.content_reports where recipe_id = new.recipe_id) >= 3 then
    update public.recipes set status = 'in_review'
    where id = new.recipe_id and author_id is not null and status = 'published';
  end if;
  return new;
end $$;
create trigger content_reports_auto_moderate after insert on public.content_reports
  for each row execute function private.auto_moderate_on_report();

-- ---- Soporte ----------------------------------------------------------------
create table public.support_tickets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  category        public.ticket_category not null,
  message         varchar(500) not null check (char_length(message) >= 1),
  app_version     text,
  device_model    text,
  screenshot_path text,
  created_at      timestamptz not null default now()
);
create index support_tickets_user_idx on public.support_tickets (user_id, created_at desc);

-- ---- Asistente conversacional ----------------------------------------------
create table public.assistant_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index assistant_conversations_user_idx on public.assistant_conversations (user_id, created_at desc);

create table public.assistant_messages (
  id                      bigint generated always as identity primary key,
  conversation_id         uuid not null references public.assistant_conversations(id) on delete cascade,
  role                    public.chat_role not null,
  content                 text not null,
  suggested_recipe_id     uuid references public.recipes(id),
  target_planned_meal_id  uuid references public.planned_meals(id) on delete set null,
  applied_at              timestamptz,
  created_at              timestamptz not null default now(),
  check (role = 'assistant' or (suggested_recipe_id is null and target_planned_meal_id is null and applied_at is null)),
  check (target_planned_meal_id is null or suggested_recipe_id is not null)
);
create index assistant_messages_conv_idx on public.assistant_messages (conversation_id, created_at);
comment on column public.assistant_messages.suggested_recipe_id is
  'La sugerencia es un dato tipado (receta + comida destino), no JSON libre: la base la valida como cualquier otro cambio al plan.';

-- Uso de IA por usuario (costo, latencia). Lo escribe solo el backend (service_role).
create table public.ai_generations (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  kind          public.ai_kind not null,
  model         text not null,
  input_tokens  integer check (input_tokens  >= 0),
  output_tokens integer check (output_tokens >= 0),
  latency_ms    integer check (latency_ms    >= 0),
  created_at    timestamptz not null default now()
);
create index ai_generations_user_idx on public.ai_generations (user_id, created_at desc);

-- ---- Notificaciones (registro para no enviar dos veces) --------------------
create table public.notifications (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  kind            public.notification_kind not null,
  planned_meal_id uuid references public.planned_meals(id) on delete cascade,
  pantry_item_id  uuid references public.pantry_items(id) on delete cascade,
  scheduled_for   timestamptz not null,
  sent_at         timestamptz,
  check ((kind = 'meal_reminder') = (planned_meal_id is not null)),
  check ((kind = 'expiry_alert')  = (pantry_item_id  is not null)),
  unique (kind, planned_meal_id),
  unique (kind, pantry_item_id)
);
create unique index notifications_weekly_uq on public.notifications (user_id, scheduled_for) where kind = 'weekly_summary';
create index notifications_pending_idx on public.notifications (scheduled_for) where sent_at is null;

-- ---- Analítica anónima ------------------------------------------------------
-- Sin user_id a propósito: solo un id aleatorio por instalación. Ninguna fila contiene alergias, salud ni datos personales.
create table public.analytics_events (
  id           bigint generated always as identity primary key,
  anonymous_id uuid not null,
  event_type   public.analytics_event not null,
  occurred_at  timestamptz not null default now(),
  app_version  text,
  platform     public.device_platform
);
create index analytics_events_type_time_idx on public.analytics_events (event_type, occurred_at desc);
