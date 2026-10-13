-- =============================================================================
-- 0003 · Identidad, privacidad y consentimiento
-- profiles cuelga de auth.users; borrar el usuario borra en cascada todos sus datos.
-- =============================================================================

create table public.profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  display_name            text check (char_length(display_name) <= 80),
  region_id               smallint references public.regions(id),
  household_size          smallint not null default 2 check (household_size between 1 and 12),
  budget_amount           numeric(12,2) check (budget_amount > 0),
  budget_period           public.budget_period,
  max_cook_minutes        smallint check (max_cook_minutes between 5 and 240),
  spice_tolerance         smallint not null default 2 check (spice_tolerance between 0 and 3),
  target_protein_pct      smallint check (target_protein_pct between 10 and 50),
  daily_kcal_target       integer  check (daily_kcal_target between 800 and 6000),
  prioritize_pantry       boolean  not null default true,
  batch_cooking           boolean  not null default false,
  analytics_enabled       boolean  not null default true,
  onboarding_completed_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check ((budget_amount is null) = (budget_period is null))
);
comment on column public.profiles.budget_amount is 'Monto y periodo van juntos. La moneda se deriva de region_id > countries.';
comment on column public.profiles.spice_tolerance is 'Nivel máximo de picante aceptado: 0 ninguno, 1 suave, 2 medio, 3 picante.';
comment on column public.profiles.target_protein_pct is 'Carbohidratos y grasa se derivan; no se guardan para evitar inconsistencias.';
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- Datos de salud en tabla aparte: otro nivel de sensibilidad, otra política, auditable por separado.
create table public.profile_health (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  sex            public.sex,
  birth_date     date check (birth_date <= (current_date - interval '18 years')::date),
  height_cm      numeric(4,1) check (height_cm between 50 and 260),
  weight_kg      numeric(5,1) check (weight_kg between 20 and 400),
  activity_level public.activity_level,
  goal           public.health_goal,
  updated_at     timestamptz not null default now()
);
comment on table public.profile_health is
  'Datos sensibles (Ley 1581/2012). Solo el dueño los lee. El cifrado a nivel de campo es una decisión abierta (ver documento).';
comment on column public.profile_health.birth_date is 'Se exige mayoría de edad (18). Decisión de producto/legal: ajustar si se admiten menores con autorización.';
create trigger profile_health_updated_at before update on public.profile_health
  for each row execute function private.set_updated_at();

-- Roles de personal (moderación, revisión nutricional). Solo los asigna service_role.
create table public.user_roles (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       public.app_role not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create function private.has_role(p_role public.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role = p_role
  )
$$;

-- Consentimiento versionado: la versión y el tipo se derivan del documento aceptado.
create table public.user_consents (
  user_id     uuid     not null references public.profiles(id) on delete cascade,
  document_id smallint not null references public.legal_documents(id),
  accepted_at timestamptz not null default now(),
  primary key (user_id, document_id)
);

create function private.latest_legal_document(p_kind public.legal_doc_kind)
returns smallint language sql stable set search_path = '' as $$
  select id from public.legal_documents where kind = p_kind order by version desc limit 1
$$;

create function private.has_consent(p_user uuid, p_kind public.legal_doc_kind)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_consents uc
    join public.legal_documents ld on ld.id = uc.document_id
    where uc.user_id = p_user and ld.kind = p_kind
  )
$$;

create table public.notification_preferences (
  user_id                    uuid primary key references public.profiles(id) on delete cascade,
  frequency                  public.notification_frequency not null default 'daily',
  meal_reminder_lead_minutes smallint not null default 30 check (meal_reminder_lead_minutes between 0 and 240),
  expiry_alerts_enabled      boolean not null default true,
  updated_at                 timestamptz not null default now()
);
create trigger notification_preferences_updated_at before update on public.notification_preferences
  for each row execute function private.set_updated_at();

create table public.push_devices (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null unique,
  platform        public.device_platform not null,
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now()
);
create index push_devices_user_idx on public.push_devices(user_id);

-- Alta de usuario: sin aceptar la versión VIGENTE de la política de privacidad no hay cuenta.
-- La app envía el id del documento en options.data al llamar a signUp().
create function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_latest   smallint := private.latest_legal_document('privacy_policy');
  v_accepted smallint := nullif(new.raw_user_meta_data ->> 'privacy_policy_document_id', '')::smallint;
begin
  if v_accepted is distinct from v_latest then
    raise exception 'consent_required: debes aceptar la política de privacidad vigente'
      using errcode = 'P0001';
  end if;

  insert into public.profiles (id) values (new.id);
  insert into public.notification_preferences (user_id) values (new.id);
  insert into public.user_consents (user_id, document_id) values (new.id, v_latest);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();
