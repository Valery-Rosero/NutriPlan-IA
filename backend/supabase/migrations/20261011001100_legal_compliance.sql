-- =====================================================================
-- Cumplimiento (Ley 1581 de 2012 y decretos reglamentarios): mayoría de edad,
-- autorización de datos sensibles, revocatoria, minimización y constancia de lo aceptado.
-- Estas reglas son una implementación técnica de una decisión legal: confirmar con un abogado.
-- =====================================================================

-- ---- 1. Constancia del texto aceptado ----------------------------------------
alter table public.legal_documents add column content_sha256 text;
alter table public.legal_documents add constraint legal_documents_content_pair
  check ((content_url is null) = (content_sha256 is null));
comment on column public.legal_documents.content_sha256 is
  'Hash del texto publicado: prueba de qué versión exacta aceptó cada persona (art. 9 y 17 Ley 1581).';

insert into public.legal_documents (kind, version) values ('sensitive_data_authorization', 1);

-- Documentos vigentes sin texto cargado: debe devolver cero filas antes del lanzamiento.
create function private.legal_readiness()
returns table (kind public.legal_doc_kind, version smallint, has_text boolean)
language sql stable set search_path = '' as $$
  select ld.kind, ld.version, ld.content_url is not null
  from public.legal_documents ld
  where ld.version = (select max(x.version) from public.legal_documents x where x.kind = ld.kind)
  order by ld.kind
$$;

-- ---- 2. Consentimientos revocables --------------------------------------------
alter table public.user_consents add column revoked_at timestamptz;
comment on column public.user_consents.revoked_at is
  'Revocatoria de la autorización (art. 8 Ley 1581). El registro se conserva como prueba; los datos asociados se borran.';

create or replace function private.has_consent(p_user uuid, p_kind public.legal_doc_kind)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_consents uc
    join public.legal_documents ld on ld.id = uc.document_id
    where uc.user_id = p_user and ld.kind = p_kind and uc.revoked_at is null
  )
$$;

-- Aceptar (o volver a aceptar tras revocar) un documento.
create function public.accept_consent(p_document_id smallint)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  insert into public.user_consents (user_id, document_id) values (v_user, p_document_id)
  on conflict (user_id, document_id) do update set accepted_at = now(), revoked_at = null;
end $$;

-- Revocar: se corta el tratamiento y se borran los datos que dependían de esa autorización.
create function public.revoke_consent(p_kind public.legal_doc_kind)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_n    int;
  v_out  jsonb := '{}'::jsonb;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_kind not in ('sensitive_data_authorization', 'community_sharing') then
    raise exception 'not_revocable: este documento no se revoca; para salir de la app elimina tu cuenta' using errcode = 'P0001';
  end if;

  update public.user_consents uc set revoked_at = now()
  from public.legal_documents ld
  where ld.id = uc.document_id and ld.kind = p_kind and uc.user_id = v_user and uc.revoked_at is null;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'consent_not_found: no hay una autorización vigente para revocar' using errcode = 'P0002'; end if;

  if p_kind = 'sensitive_data_authorization' then
    delete from public.user_allergens where user_id = v_user;        get diagnostics v_n = row_count; v_out := v_out || jsonb_build_object('user_allergens', v_n);
    delete from public.user_diets where user_id = v_user;            get diagnostics v_n = row_count; v_out := v_out || jsonb_build_object('user_diets', v_n);
    delete from public.user_conditions where user_id = v_user;       get diagnostics v_n = row_count; v_out := v_out || jsonb_build_object('user_conditions', v_n);
    delete from public.profile_health where user_id = v_user;        get diagnostics v_n = row_count; v_out := v_out || jsonb_build_object('profile_health', v_n);
  else
    delete from public.recipe_comments where user_id = v_user;       get diagnostics v_n = row_count; v_out := v_out || jsonb_build_object('comments', v_n);
    update public.recipes set status = 'draft' where author_id = v_user and status = 'published';
    get diagnostics v_n = row_count; v_out := v_out || jsonb_build_object('recipes_unpublished', v_n);
  end if;
  return v_out;
end $$;

-- ---- 3. Mayoría de edad y alta de usuario ---------------------------------------
alter table public.profiles add column adult_declared_at timestamptz;
comment on column public.profiles.adult_declared_at is
  'Momento en que la persona declaró ser mayor de 18 años. Se guarda solo la declaración, no la fecha de nacimiento (minimización).';

create function private.lock_adult_declaration()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.adult_declared_at is distinct from old.adult_declared_at then
    raise exception 'adult_declaration_locked: la declaración de mayoría de edad no se modifica' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger profiles_lock_adult before update on public.profiles
  for each row execute function private.lock_adult_declaration();

-- Sin política y términos vigentes y sin declarar mayoría de edad no hay cuenta.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_priv  smallint := private.latest_legal_document('privacy_policy');
  v_terms smallint := private.latest_legal_document('terms');
  v_meta  jsonb    := new.raw_user_meta_data;
begin
  if nullif(v_meta ->> 'privacy_policy_document_id', '')::smallint is distinct from v_priv then
    raise exception 'consent_required: debes aceptar la política de tratamiento de datos vigente' using errcode = 'P0001';
  end if;
  if nullif(v_meta ->> 'terms_document_id', '')::smallint is distinct from v_terms then
    raise exception 'consent_required: debes aceptar los términos y condiciones vigentes' using errcode = 'P0001';
  end if;
  if (v_meta ->> 'is_adult') is distinct from 'true' then
    raise exception 'adult_required: NutriPlan AI es solo para mayores de 18 años' using errcode = 'P0001';
  end if;

  insert into public.profiles (id, adult_declared_at) values (new.id, now());
  insert into public.notification_preferences (user_id) values (new.id);
  insert into public.user_consents (user_id, document_id) values (new.id, v_priv), (new.id, v_terms);
  return new;
end $$;

-- ---- 4. Datos sensibles: autorización expresa y separada -------------------------
-- Sensibles aquí: salud (medidas, condiciones, alergias) y dietas, que pueden revelar
-- convicciones religiosas o filosóficas (halal, kosher, vegano).
alter table public.profile_health drop column birth_date;
alter table public.profile_health add column birth_year smallint
  check (birth_year between 1900 and extract(year from current_date)::int - 18);
comment on column public.profile_health.birth_year is
  'Solo el año: alcanza para calcular necesidades y evita guardar la fecha completa (minimización).';
comment on table public.profile_health is
  'Datos sensibles (Ley 1581/2012, art. 5). Requieren autorización expresa y separada (sensitive_data_authorization); se borran si se revoca.';

create function private.require_sensitive_authorization()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not private.has_consent(new.user_id, 'sensitive_data_authorization') then
    raise exception 'sensitive_authorization_required: se necesita tu autorización expresa para tratar datos de salud y dietas'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger profile_health_sensitive_auth    before insert on public.profile_health
  for each row execute function private.require_sensitive_authorization();
create trigger user_conditions_sensitive_auth   before insert on public.user_conditions
  for each row execute function private.require_sensitive_authorization();
create trigger user_allergens_sensitive_auth    before insert on public.user_allergens
  for each row execute function private.require_sensitive_authorization();
create trigger user_diets_sensitive_auth        before insert on public.user_diets
  for each row execute function private.require_sensitive_authorization();

-- ---- 5. Consentimientos pendientes: lo revocado no se vuelve a pedir --------------
create or replace view public.my_pending_consents with (security_invoker = true) as
select ld.id as document_id, ld.kind, ld.version
from public.legal_documents ld
where ld.version = (select max(x.version) from public.legal_documents x where x.kind = ld.kind)
  and not exists (select 1 from public.user_consents uc
                  where uc.user_id = (select auth.uid()) and uc.document_id = ld.id)
  and not exists (select 1 from public.user_consents r
                  join public.legal_documents rd on rd.id = r.document_id
                  where r.user_id = (select auth.uid()) and rd.kind = ld.kind and r.revoked_at is not null)
  and (ld.kind in ('privacy_policy', 'terms')
       or exists (select 1 from public.user_consents uc2
                  join public.legal_documents old on old.id = uc2.document_id
                  where uc2.user_id = (select auth.uid()) and old.kind = ld.kind));

-- ---- 6. Permisos ------------------------------------------------------------------
revoke execute on function public.accept_consent(smallint), public.revoke_consent(public.legal_doc_kind) from public, anon;
grant  execute on function public.accept_consent(smallint), public.revoke_consent(public.legal_doc_kind) to authenticated;
revoke execute on function private.legal_readiness() from public, anon, authenticated;
