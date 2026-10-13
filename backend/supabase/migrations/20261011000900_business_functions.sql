-- =============================================================================
-- 0009 · Funciones de negocio (RPC) y vistas del usuario
-- Las reglas que protegen al usuario viven aquí, no en la app ni en el modelo de IA.
-- Todas SECURITY INVOKER (respetan RLS) salvo export_my_data, que filtra por auth.uid() de forma explícita.
-- =============================================================================

-- ---- Recetas que SÍ puede comer este usuario --------------------------------
-- Filtro determinista: la IA solo ordena dentro de este conjunto, nunca lo amplía.
create function public.eligible_recipes(p_slot public.meal_slot default null, p_max_minutes integer default null)
returns setof public.recipes
language sql stable set search_path = '' as $$
  select r.*
  from public.recipes r
  cross join (
    select p.id, p.max_cook_minutes, p.spice_tolerance, p.batch_cooking
    from public.profiles p where p.id = (select auth.uid())
  ) me
  where r.status = 'published'
    -- tipo de comida
    and (p_slot is null or exists (select 1 from public.recipe_meal_slots s where s.recipe_id = r.id and s.slot = p_slot))
    -- tiempo máximo
    and r.total_minutes <= coalesce(p_max_minutes, me.max_cook_minutes, 32767)
    -- ALERGIAS (duro, incluye ingredientes opcionales)
    and not private.recipe_conflicts_with_user(r.id, me.id)
    -- DIETAS (duro): toda dieta del usuario debe estar entre las compatibles de la receta
    and not exists (
      select 1 from public.user_diets ud
      where ud.user_id = me.id
        and not exists (select 1 from public.recipe_diets rd where rd.recipe_id = r.id and rd.diet_id = ud.diet_id))
    -- ingredientes que no le gustan (blando, ignora opcionales)
    and not exists (
      select 1 from public.recipe_ingredients ri
      join public.user_disliked_ingredients dis on dis.ingredient_id = ri.ingredient_id
      where ri.recipe_id = r.id and dis.user_id = me.id and not ri.is_optional)
    -- picante
    and coalesce((select mh.heat_level from public.recipe_max_heat mh where mh.recipe_id = r.id), 0) <= me.spice_tolerance
    -- calificada con 1-2 estrellas en los últimos 60 días: no vuelve
    and not exists (
      select 1 from public.recipe_ratings rr
      where rr.user_id = me.id and rr.recipe_id = r.id and rr.rating <= 2
        and rr.rated_at > now() - interval '60 days')
    -- batch cooking: en almuerzo y cena solo recetas que rinden >=4 y se conservan
    and (not me.batch_cooking or p_slot is null or p_slot not in ('lunch', 'dinner')
         or (r.base_servings >= 4 and r.keeps_days is not null))
$$;

create function public.suggest_substitutes(p_ingredient_id uuid)
returns table (substitute_id uuid, substitute_name text, ratio numeric, note text)
language sql stable set search_path = '' as $$
  select s.substitute_id, i.name, s.ratio, s.note
  from public.ingredient_substitutions s
  join public.ingredients i on i.id = s.substitute_id
  where s.ingredient_id = p_ingredient_id
    and not private.ingredient_blocked_for_user(s.substitute_id, (select auth.uid()))
  order by i.name
$$;

-- ---- Despensa ---------------------------------------------------------------
create function public.add_to_pantry(p_ingredient_id uuid, p_quantity numeric, p_unit_id smallint,
                                     p_expires_on date default null)
returns public.pantry_items
language plpgsql set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_g    numeric;
  v_row  public.pantry_items;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid_quantity: la cantidad debe ser mayor que 0' using errcode = '22023';
  end if;

  v_g := round(private.to_grams(p_ingredient_id, p_quantity, p_unit_id), 2);   -- falla con unit_incompatible

  insert into public.pantry_items (user_id, ingredient_id, quantity_g, expires_on)
  values (v_user, p_ingredient_id, v_g, p_expires_on)
  on conflict on constraint pantry_batch_uq
  do update set quantity_g = public.pantry_items.quantity_g + excluded.quantity_g
  returning * into v_row;
  return v_row;
end $$;

create function public.recipe_pantry_match(p_recipe_id uuid)
returns table (matched_ingredients integer, total_ingredients integer, coverage numeric)
language sql stable set search_path = '' as $$
  with req as (
    select ri.ingredient_id,
           exists (select 1 from public.pantry_items pi
                   where pi.user_id = (select auth.uid()) and pi.ingredient_id = ri.ingredient_id
                     and pi.quantity_g > 0 and (pi.expires_on is null or pi.expires_on >= current_date)) as in_pantry
    from public.recipe_ingredients ri
    where ri.recipe_id = p_recipe_id and not ri.is_optional)
  select (count(*) filter (where in_pantry))::int,
         count(*)::int,
         case when count(*) = 0 then 0 else round((count(*) filter (where in_pantry))::numeric / count(*), 2) end
  from req
$$;

-- Ingredientes por vencer + recetas REALES (elegibles para este usuario) que los usan.
create function public.recipes_using_expiring_ingredients(p_within_days integer default 3)
returns table (pantry_item_id uuid, ingredient_id uuid, ingredient_name text, expires_on date,
               days_left integer, recipe_id uuid, recipe_title text)
language sql stable set search_path = '' as $$
  select pi.id, pi.ingredient_id, i.name, pi.expires_on, (pi.expires_on - current_date)::int, rec.id, rec.title
  from public.pantry_items pi
  join public.ingredients i on i.id = pi.ingredient_id
  cross join lateral (
    select er.id, er.title
    from public.eligible_recipes() er
    join public.recipe_ingredients ri on ri.recipe_id = er.id and ri.ingredient_id = pi.ingredient_id and not ri.is_optional
    order by er.total_minutes, er.title
    limit 3
  ) rec
  where pi.user_id = (select auth.uid())
    and pi.quantity_g > 0
    and pi.expires_on between current_date and current_date + p_within_days
  order by pi.expires_on, i.name, rec.title
$$;

-- ---- Lista de compras -------------------------------------------------------
-- Suma lo necesario del plan (comidas aún no cocinadas), resta lo que hay en despensa y no vencido.
create function public.generate_shopping_list(p_plan_id uuid)
returns uuid
language plpgsql set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_list uuid;
begin
  if not exists (select 1 from public.meal_plans where id = p_plan_id and user_id = v_user) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;

  insert into public.shopping_lists (user_id, plan_id) values (v_user, p_plan_id)
  on conflict (plan_id) where plan_id is not null do update set updated_at = now()
  returning id into v_list;

  with needs as (
    select s.ingredient_id, round(sum(s.grams), 2) as grams
    from public.planned_meals pm
    cross join lateral public.scale_recipe(pm.recipe_id, pm.servings) s
    where pm.plan_id = p_plan_id and pm.status = 'planned' and not s.is_optional
    group by s.ingredient_id
  ),
  stock as (
    select pi.ingredient_id, sum(pi.quantity_g) as grams
    from public.pantry_items pi
    where pi.user_id = v_user and pi.quantity_g > 0 and (pi.expires_on is null or pi.expires_on >= current_date)
    group by pi.ingredient_id
  ),
  purge as (   -- ítems del plan que ya no se necesitan (y que el usuario no marcó)
    delete from public.shopping_list_items sli
    where sli.list_id = v_list and sli.source = 'plan' and not sli.is_checked
      and sli.ingredient_id not in (select ingredient_id from needs)
  )
  insert into public.shopping_list_items (list_id, ingredient_id, needed_g, pantry_g, source)
  select v_list, n.ingredient_id, n.grams, coalesce(st.grams, 0), 'plan'
  from needs n left join stock st on st.ingredient_id = n.ingredient_id
  where n.grams > 0
  on conflict (list_id, ingredient_id) do update
    set needed_g = excluded.needed_g, pantry_g = excluded.pantry_g
    where public.shopping_list_items.source = 'plan';

  return v_list;
end $$;

-- ---- Presupuesto ------------------------------------------------------------
create function public.plan_budget_status(p_plan_id uuid)
returns table (estimated_cost numeric, budget_limit numeric, over_by numeric,
               currency_code char(3), missing_prices integer, estimated_prices integer)
language plpgsql stable set search_path = '' as $$
declare
  v_user   uuid := (select auth.uid());
  v_region smallint;
  v_limit  numeric;
begin
  select p.region_id into v_region from public.profiles p where p.id = v_user;
  if v_region is null then
    raise exception 'region_required: elige tu región para estimar costos' using errcode = 'P0001';
  end if;
  select mp.budget_limit into v_limit from public.meal_plans mp where mp.id = p_plan_id and mp.user_id = v_user;
  if not found then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;

  return query
  select coalesce(round(sum(c.cost), 2), 0),
         v_limit,
         case when v_limit is null then null else greatest(coalesce(round(sum(c.cost), 2), 0) - v_limit, 0) end,
         max(c.currency_code)::char(3),
         coalesce(sum(c.missing_prices), 0)::int,
         coalesce(sum(c.estimated_prices), 0)::int
  from public.planned_meals pm
  cross join lateral public.recipe_cost(pm.recipe_id, v_region, pm.servings) c
  where pm.plan_id = p_plan_id and pm.status <> 'skipped';
end $$;

-- ---- Cocinar: descuenta la despensa (primero lo que vence antes) y permite deshacer ----
create function public.mark_meal_cooked(p_planned_meal_id uuid)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_user  uuid := (select auth.uid());
  v_pm    public.planned_meals;
  v_line  record;
  v_batch record;
  v_need  numeric;
  v_take  numeric;
  v_total numeric := 0;
  v_short jsonb := '[]'::jsonb;
begin
  select pm.* into v_pm
  from public.planned_meals pm join public.meal_plans p on p.id = pm.plan_id
  where pm.id = p_planned_meal_id and p.user_id = v_user
  for update of pm;
  if not found then
    raise exception 'meal_not_found' using errcode = 'P0002';
  end if;
  if v_pm.status <> 'planned' then
    raise exception 'meal_not_pending: la comida ya fue cocinada u omitida' using errcode = 'P0001';
  end if;

  for v_line in
    select s.ingredient_id, s.ingredient_name, s.grams
    from public.scale_recipe(v_pm.recipe_id, v_pm.servings) s
    where not s.is_optional
  loop
    v_need := v_line.grams;
    for v_batch in
      select pi.id, pi.quantity_g from public.pantry_items pi
      where pi.user_id = v_user and pi.ingredient_id = v_line.ingredient_id
        and pi.quantity_g > 0 and (pi.expires_on is null or pi.expires_on >= current_date)
      order by pi.expires_on nulls last, pi.created_at
      for update
    loop
      exit when v_need <= 0;
      v_take := least(v_batch.quantity_g, v_need);
      update public.pantry_items set quantity_g = quantity_g - v_take where id = v_batch.id;
      insert into public.meal_pantry_deductions (planned_meal_id, pantry_item_id, grams)
      values (p_planned_meal_id, v_batch.id, v_take);
      v_need  := v_need - v_take;
      v_total := v_total + v_take;
    end loop;
    if v_need > 0.005 then   -- la despensa no alcanzó: se descuenta hasta 0 y se informa, no se bloquea
      v_short := v_short || jsonb_build_object('ingredient_id', v_line.ingredient_id,
                                               'ingredient_name', v_line.ingredient_name,
                                               'missing_g', round(v_need, 2));
    end if;
  end loop;

  update public.planned_meals set status = 'cooked', cooked_at = now() where id = p_planned_meal_id;
  return jsonb_build_object('planned_meal_id', p_planned_meal_id,
                            'deducted_g', round(v_total, 2),
                            'shortfall', v_short);
end $$;

create function public.undo_meal_cooked(p_planned_meal_id uuid, p_window interval default interval '10 seconds')
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
  if now() - v_pm.cooked_at > p_window then
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

-- ---- Asistente: aplicar una sugerencia pasa por las MISMAS validaciones que cualquier cambio ----
create function public.apply_assistant_suggestion(p_message_id bigint)
returns uuid
language plpgsql set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_msg  public.assistant_messages;
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

  -- el trigger planned_meals_validate rechaza recetas con alérgenos o no publicadas
  update public.planned_meals
     set replaced_recipe_id = recipe_id,
         recipe_id = v_msg.suggested_recipe_id,
         reason_code = 'user_request',
         reason_ingredient_id = null
   where id = v_msg.target_planned_meal_id and status = 'planned';
  if not found then
    raise exception 'meal_not_found: la comida destino ya no se puede cambiar' using errcode = 'P0002';
  end if;

  update public.assistant_messages set applied_at = now() where id = p_message_id;
  return v_msg.target_planned_meal_id;
end $$;

-- ---- Consentimientos pendientes ---------------------------------------------
-- privacidad y términos: siempre exigibles. Aviso de salud y comunidad: solo si ya aceptó una versión anterior.
create view public.my_pending_consents with (security_invoker = true) as
select ld.id as document_id, ld.kind, ld.version
from public.legal_documents ld
where ld.version = (select max(x.version) from public.legal_documents x where x.kind = ld.kind)
  and not exists (select 1 from public.user_consents uc
                  where uc.user_id = (select auth.uid()) and uc.document_id = ld.id)
  and (ld.kind in ('privacy_policy', 'terms')
       or exists (select 1 from public.user_consents uc2
                  join public.legal_documents old on old.id = uc2.document_id
                  where uc2.user_id = (select auth.uid()) and old.kind = ld.kind));

-- ---- Exportar todos mis datos (derecho de acceso/portabilidad) --------------
-- SECURITY DEFINER para incluir tablas que el usuario no puede leer directamente (notificaciones, uso de IA).
-- Cada subconsulta filtra de forma EXPLÍCITA por auth.uid(): es el único control de acceso aquí.
create function public.export_my_data()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'exported_at', now(),
    'profile',        (select to_jsonb(t) from public.profiles t where t.id = v_user),
    'health',         (select to_jsonb(t) from public.profile_health t where t.user_id = v_user),
    'notification_preferences', (select to_jsonb(t) from public.notification_preferences t where t.user_id = v_user),
    'consents',       (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.user_consents t where t.user_id = v_user),
    'diets',          (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.user_diets t where t.user_id = v_user),
    'allergens',      (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.user_allergens t where t.user_id = v_user),
    'conditions',     (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.user_conditions t where t.user_id = v_user),
    'disliked_ingredients', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.user_disliked_ingredients t where t.user_id = v_user),
    'cuisines',       (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.user_cuisines t where t.user_id = v_user),
    'favorite_recipes', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.favorite_recipes t where t.user_id = v_user),
    'section_order',  (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.user_section_order t where t.user_id = v_user),
    'pantry',         (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.pantry_items t where t.user_id = v_user),
    'meal_plans',     (select coalesce(jsonb_agg(to_jsonb(p) || jsonb_build_object('meals',
                         (select coalesce(jsonb_agg(to_jsonb(pm)), '[]') from public.planned_meals pm where pm.plan_id = p.id))), '[]')
                       from public.meal_plans p where p.user_id = v_user),
    'shopping_lists', (select coalesce(jsonb_agg(to_jsonb(l) || jsonb_build_object('items',
                         (select coalesce(jsonb_agg(to_jsonb(i)), '[]') from public.shopping_list_items i where i.list_id = l.id))), '[]')
                       from public.shopping_lists l where l.user_id = v_user),
    'purchases',      (select coalesce(jsonb_agg(to_jsonb(p) || jsonb_build_object('items',
                         (select coalesce(jsonb_agg(to_jsonb(i)), '[]') from public.purchase_items i where i.purchase_id = p.id))), '[]')
                       from public.purchases p where p.user_id = v_user),
    'ratings',        (select coalesce(jsonb_agg(to_jsonb(r) || jsonb_build_object('tags',
                         (select coalesce(jsonb_agg(l.tag_id), '[]') from public.recipe_rating_tag_links l where l.rating_id = r.id))), '[]')
                       from public.recipe_ratings r where r.user_id = v_user),
    'comments',       (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.recipe_comments t where t.user_id = v_user),
    'authored_recipes', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'status', t.status)), '[]')
                         from public.recipes t where t.author_id = v_user),
    'reports',        (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.content_reports t where t.reporter_id = v_user),
    'support_tickets', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.support_tickets t where t.user_id = v_user),
    'assistant_conversations', (select coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object('messages',
                         (select coalesce(jsonb_agg(to_jsonb(m) order by m.id), '[]') from public.assistant_messages m where m.conversation_id = c.id))), '[]')
                       from public.assistant_conversations c where c.user_id = v_user),
    'ai_usage',       (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.ai_generations t where t.user_id = v_user),
    'notifications',  (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.notifications t where t.user_id = v_user),
    'push_devices',   (select coalesce(jsonb_agg(to_jsonb(t) - 'expo_push_token'), '[]') from public.push_devices t where t.user_id = v_user)
  );
end $$;

-- ---- Permisos de ejecución --------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated, service_role;
grant  select  on public.my_monthly_spend, public.my_plan_conflicts, public.my_pending_consents,
                  public.recipe_allergens, public.recipe_diets, public.recipe_max_heat, public.recipe_nutrition
       to authenticated;
