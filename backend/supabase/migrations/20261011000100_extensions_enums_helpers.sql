-- =============================================================================
-- 0001 · Extensiones, tipos enumerados y utilidades
-- NutriPlan AI · Postgres 15+ (Supabase)
-- Convenciones: identificadores en inglés (snake_case), comentarios en español,
-- PK uuid en datos de usuario, smallint identity en tablas de referencia,
-- timestamptz siempre, dinero en numeric(12,2), cantidades canónicas en gramos.
-- =============================================================================

create schema if not exists private;      -- NO se expone en la Data API de Supabase
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create extension if not exists pg_trgm    with schema extensions;  -- búsqueda difusa
create extension if not exists unaccent   with schema extensions;  -- "limon" = "limón"
create extension if not exists btree_gist with schema extensions;  -- planes sin traslape

-- Enumerados: solo para conjuntos pequeños, cerrados y estables.
-- Los conjuntos abiertos (dietas, alérgenos, cocinas...) son tablas de referencia.
create type public.diet_kind              as enum ('rule_based', 'curated');
create type public.units_dimension        as enum ('mass', 'volume', 'count');
create type public.meal_slot              as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type public.plan_status            as enum ('draft', 'confirmed', 'archived');
create type public.meal_status            as enum ('planned', 'cooked', 'skipped');
create type public.recipe_status          as enum ('draft', 'in_review', 'published', 'rejected');
create type public.review_outcome         as enum ('approved', 'rejected');
create type public.budget_period          as enum ('week', 'month');
create type public.notification_frequency as enum ('none', 'weekly_summary', 'daily');
create type public.notification_kind      as enum ('meal_reminder', 'expiry_alert', 'weekly_summary');
create type public.legal_doc_kind         as enum ('privacy_policy', 'terms', 'health_disclaimer', 'community_sharing');
create type public.app_role               as enum ('moderator', 'nutritionist', 'admin');
create type public.sex                    as enum ('female', 'male', 'prefer_not_say');
create type public.activity_level         as enum ('sedentary', 'light', 'moderate', 'active', 'very_active');
create type public.health_goal            as enum ('lose_weight', 'maintain', 'gain_muscle', 'eat_healthier', 'save_time');
create type public.report_reason          as enum ('spam', 'dangerous_advice', 'offensive', 'other');
create type public.analytics_event        as enum ('onboarding_completed', 'plan_generated', 'shopping_list_generated', 'meal_cooked');
create type public.chat_role              as enum ('user', 'assistant');
create type public.ticket_category        as enum ('bug', 'suggestion');
create type public.shopping_item_source   as enum ('plan', 'manual');
create type public.list_status            as enum ('active', 'completed');
create type public.device_platform        as enum ('ios', 'android');
create type public.ai_kind                as enum ('plan', 'swap', 'chat');

-- updated_at automático
create function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- unaccent inmutable (necesario para usarlo en índices)
create function private.f_unaccent(p_text text)
returns text language sql immutable parallel safe strict set search_path = '' as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, p_text)
$$;
