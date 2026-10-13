-- =============================================================================
-- 0012 · Refuerzos de seguridad e integridad (docs/07-plan-de-construccion/plan-de-arranque.md §1.1)
-- R1 dietas en el trigger del plan · R2 el asistente revalida elegibilidad · R3 "sin dato = seguro"
-- R5 slot de la comida · R6 ventana de deshacer acotada · R7 solo versiones vigentes · R8 hora de Colombia
-- =============================================================================

-- ---- R8 · Zona horaria: "hoy" es el día de Colombia, no el de UTC ------------
-- Colombia no tiene horario de verano. Aplica a las sesiones nuevas.
do $$ begin
  execute format('alter database %I set timezone to %L', current_database(), 'America/Bogota');
end $$;

-- ---- R3 · Un ingrediente sin revisión de alérgenos no se considera seguro ----
alter table public.ingredients add column allergens_reviewed_at timestamptz;
comment on column public.ingredients.allergens_reviewed_at is
  'Fecha en que se verificó la lista de alérgenos del ingrediente. Nulo = sin revisar: ninguna receta que lo use se puede publicar (la ausencia de filas en ingredient_allergens no prueba que sea seguro).';

-- ---- R1 · ¿La receta viola alguna dieta del usuario? -------------------------
-- rule_based: algún ingrediente cae en un grupo o alérgeno excluido; curated: falta la etiqueta.
create function private.recipe_violates_user_diets(p_recipe_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_diets ud
    where ud.user_id = p_user_id
      and not exists (select 1 from public.recipe_diets rd where rd.recipe_id = p_recipe_id and rd.diet_id = ud.diet_id))
$$;

-- ---- R1 + R5 · El trigger del plan revisa alérgenos, dietas y tipo de comida ----
create or replace function private.validate_planned_meal()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_plan   record;
  v_status public.recipe_status;
begin
  select user_id, start_date, end_date into v_plan from public.meal_plans where id = new.plan_id;
  if not found then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if new.meal_date < v_plan.start_date or new.meal_date > v_plan.end_date then
    raise exception 'meal_date_out_of_plan: la fecha queda fuera del rango del plan' using errcode = '22023';
  end if;

  select status into v_status from public.recipes where id = new.recipe_id;
  if v_status is distinct from 'published' then
    raise exception 'recipe_not_published: solo se pueden planear recetas publicadas' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.recipe_meal_slots s where s.recipe_id = new.recipe_id and s.slot = new.slot) then
    raise exception 'slot_mismatch: la receta no corresponde a este tipo de comida' using errcode = 'P0001';
  end if;

  if private.recipe_conflicts_with_user(new.recipe_id, v_plan.user_id) then
    raise exception 'allergen_conflict: la receta contiene un alérgeno que el usuario declaró' using errcode = 'P0001';
  end if;
  if private.recipe_violates_user_diets(new.recipe_id, v_plan.user_id) then
    raise exception 'diet_conflict: la receta no es compatible con la dieta del usuario' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger planned_meals_validate on public.planned_meals;
create trigger planned_meals_validate
  before insert or update of plan_id, meal_date, slot, recipe_id on public.planned_meals
  for each row execute function private.validate_planned_meal();

-- Conflictos de comidas futuras: alergias o dietas declaradas DESPUÉS de planear.
create or replace view public.my_plan_conflicts with (security_invoker = true) as
select pm.id as planned_meal_id, pm.plan_id, pm.meal_date, pm.slot, pm.recipe_id,
       case when private.recipe_conflicts_with_user(pm.recipe_id, p.user_id) then 'allergen' else 'diet' end as conflict
from public.planned_meals pm
join public.meal_plans p on p.id = pm.plan_id
where pm.status = 'planned'
  and pm.meal_date >= current_date
  and (private.recipe_conflicts_with_user(pm.recipe_id, p.user_id)
       or private.recipe_violates_user_diets(pm.recipe_id, p.user_id));

-- ---- R3 · Publicación: ingredientes con nutrición Y alérgenos revisados -------
create or replace function private.enforce_recipe_publishable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.recipe_ingredients where recipe_id = new.id) then
    raise exception 'recipe_incomplete: la receta no tiene ingredientes' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.recipe_steps where recipe_id = new.id) then
    raise exception 'recipe_incomplete: la receta no tiene pasos' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.recipe_meal_slots where recipe_id = new.id) then
    raise exception 'recipe_incomplete: la receta no tiene tipo de comida' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.recipe_ingredients ri
    left join public.ingredient_nutrition n on n.ingredient_id = ri.ingredient_id
    where ri.recipe_id = new.id and n.ingredient_id is null
  ) then
    raise exception 'recipe_missing_nutrition: hay ingredientes sin datos nutricionales' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.recipe_ingredients ri
    join public.ingredients i on i.id = ri.ingredient_id
    where ri.recipe_id = new.id and i.allergens_reviewed_at is null
  ) then
    raise exception 'allergens_unreviewed: hay ingredientes sin revisión de alérgenos' using errcode = 'P0001';
  end if;

  if new.author_id is null then
    if coalesce((select outcome from public.nutritionist_reviews
                  where recipe_id = new.id order by reviewed_at desc limit 1), 'rejected') <> 'approved' then
      raise exception 'review_required: la receta oficial necesita una revisión nutricional aprobada' using errcode = 'P0001';
    end if;
  elsif not private.has_consent(new.author_id, 'community_sharing') then
    raise exception 'consent_required: el autor no ha aceptado compartir en la comunidad' using errcode = 'P0001';
  end if;

  new.published_at := coalesce(new.published_at, now());
  return new;
end $$;

-- ---- R2 · Aplicar una sugerencia del asistente exige que la receta sea ELEGIBLE ----
create or replace function public.apply_assistant_suggestion(p_message_id bigint)
returns uuid
language plpgsql set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_msg  public.assistant_messages;
  v_slot public.meal_slot;
begin
  select m.* into v_msg
  from public.assistant_messages m join public.assistant_conversations c on c.id = m.conversation_id
  where m.id = p_message_id and c.user_id = v_user
  for update of m;
  if not found then
    raise exception 'message_not_found' using errcode = 'P0002';
  end if;
  if v_msg.role <> 'assistant' or v_msg.suggested_recipe_id is null or v_msg.target_planned_meal_id is null then
    raise exception 'no_suggestion: el mensaje no contiene una sugerencia aplicable' using errcode = 'P0001';
  end if;
  if v_msg.applied_at is not null then
    raise exception 'already_applied' using errcode = 'P0001';
  end if;

  select pm.slot into v_slot from public.planned_meals pm
  where pm.id = v_msg.target_planned_meal_id and pm.status = 'planned';
  if not found then
    raise exception 'meal_not_found: la comida destino ya no se puede cambiar' using errcode = 'P0002';
  end if;
  -- mismo conjunto seguro que usa el plan: alergias, dietas, tiempo, picante, calificaciones
  if not exists (select 1 from public.eligible_recipes(v_slot) e where e.id = v_msg.suggested_recipe_id) then
    raise exception 'not_eligible: la receta sugerida no cumple tus restricciones' using errcode = 'P0001';
  end if;

  update public.planned_meals
     set replaced_recipe_id = recipe_id,
         recipe_id = v_msg.suggested_recipe_id,
         reason_code = 'user_request',
         reason_ingredient_id = null
   where id = v_msg.target_planned_meal_id;

  update public.assistant_messages set applied_at = now() where id = p_message_id;
  return v_msg.target_planned_meal_id;
end $$;

-- ---- R6 · Deshacer "cocinado": 10 s de la UI + 5 s de margen de red, nunca más ----
create or replace function public.undo_meal_cooked(p_planned_meal_id uuid, p_window interval default interval '10 seconds')
returns void
language plpgsql set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_pm   public.planned_meals;
begin
  select pm.* into v_pm
  from public.planned_meals pm join public.meal_plans p on p.id = pm.plan_id
  where pm.id = p_planned_meal_id and p.user_id = v_user
  for update of pm;
  if not found then
    raise exception 'meal_not_found' using errcode = 'P0002';
  end if;
  if v_pm.status <> 'cooked' then
    raise exception 'meal_not_cooked' using errcode = 'P0001';
  end if;
  if now() - v_pm.cooked_at > least(coalesce(p_window, interval '10 seconds'), interval '15 seconds') then
    raise exception 'undo_window_expired: ya pasó el tiempo para deshacer' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.recipe_ratings where planned_meal_id = p_planned_meal_id) then
    raise exception 'already_rated: la comida ya fue calificada' using errcode = 'P0001';
  end if;

  update public.pantry_items pi set quantity_g = pi.quantity_g + d.grams
  from public.meal_pantry_deductions d
  where d.planned_meal_id = p_planned_meal_id and pi.id = d.pantry_item_id;
  delete from public.meal_pantry_deductions where planned_meal_id = p_planned_meal_id;
  update public.planned_meals set status = 'planned', cooked_at = null where id = p_planned_meal_id;
end $$;

-- ---- R7 · Solo se acepta la versión VIGENTE de un documento legal -------------
create or replace function public.accept_consent(p_document_id smallint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_kind public.legal_doc_kind;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select kind into v_kind from public.legal_documents where id = p_document_id;
  if not found then raise exception 'document_not_found' using errcode = 'P0002'; end if;
  if p_document_id is distinct from private.latest_legal_document(v_kind) then
    raise exception 'consent_outdated: ese documento ya no es la versión vigente' using errcode = 'P0001';
  end if;
  insert into public.user_consents (user_id, document_id) values (v_user, p_document_id)
  on conflict (user_id, document_id) do update set accepted_at = now(), revoked_at = null;
end $$;

drop policy user_consents_insert_own on public.user_consents;
create policy user_consents_insert_own on public.user_consents for insert to authenticated
  with check (user_id = (select auth.uid())
              and document_id = private.latest_legal_document((select ld.kind from public.legal_documents ld where ld.id = document_id)));

-- ---- Permisos de las funciones nuevas o reemplazadas -------------------------
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated, service_role;
