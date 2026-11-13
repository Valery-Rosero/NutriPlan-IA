-- US-174 (ADR-031): "Hazme la semana más barata". Cambios a varias comidas pendientes del plan a la vez, con una
-- meta (más barata, más rápida, más proteína, más variedad, usar lo que vence) y/o ingredientes a evitar.
-- La IA solo traduce la frase a meta + ingredientes; los cambios los CALCULA la base con las mismas reglas de un
-- cambio manual (eligible_recipes: alergias, dietas, tiempo, picante, calificaciones). Generaliza plan_savings.
-- Sugiere; aplicar es otra función y cada cambio se valida otra vez (trigger planned_meals_validate).

create function public.propose_week_changes(p_plan_id uuid, p_goal text default null, p_avoid uuid[] default '{}',
                                            p_limit integer default 10)
returns table (planned_meal_id uuid, meal_date date, slot public.meal_slot,
               current_recipe_id uuid, current_title text, current_cost numeric, current_minutes integer,
               new_recipe_id uuid, new_title text, new_cost numeric, new_minutes integer,
               saving numeric, reason text)
language plpgsql stable set search_path = '' as $$
#variable_conflict use_column
declare
  v_user   uuid := (select auth.uid());
  v_region smallint;
  v_avoid  uuid[] := coalesce(p_avoid, '{}');
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_goal is not null and p_goal not in ('cheaper', 'faster', 'protein', 'variety', 'use_expiring') then
    raise exception 'invalid_goal: meta desconocida' using errcode = '22023';
  end if;
  if p_goal is null and cardinality(v_avoid) = 0 then
    raise exception 'invalid_goal: elige una meta o algo que evitar' using errcode = '22023';
  end if;
  if cardinality(v_avoid) > 5 then
    raise exception 'invalid_goal: máximo 5 ingredientes a evitar' using errcode = '22023';
  end if;
  if not exists (select 1 from public.meal_plans mp where mp.id = p_plan_id and mp.user_id = v_user) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  select p.region_id into v_region from public.profiles p where p.id = v_user;
  if p_goal = 'cheaper' and v_region is null then
    raise exception 'region_required: elige tu región para estimar costos' using errcode = 'P0001';
  end if;

  return query
  with meals as (
    -- Solo lo pendiente de hoy en adelante: lo cocinado, omitido o adicional nunca se toca.
    select pm.id as meal_id, pm.meal_date as m_date, pm.slot as m_slot, pm.recipe_id as m_recipe, pm.servings as m_servings,
           r.title as m_title, r.total_minutes as m_minutes,
           row_number() over (partition by pm.recipe_id order by pm.meal_date, pm.slot) as m_repeat
    from public.planned_meals pm join public.recipes r on r.id = pm.recipe_id
    where pm.plan_id = p_plan_id and pm.status = 'planned' and not pm.is_extra and pm.meal_date >= current_date
  ),
  expiring as (
    select distinct pi.ingredient_id from public.pantry_items pi
    where pi.user_id = v_user and pi.quantity_g > 0 and pi.expires_on between current_date and current_date + 3
  ),
  -- Lo que se cocinaría hoy en cada comida (con sus opciones elegidas) y lo de cada alternativa.
  cur as (
    select m.meal_id,
           sum(l.grams / 1000 * pr.price_per_kg) as c_cost,
           bool_and(pr.price_per_kg is not null or i.is_staple) as c_complete,
           sum(l.grams / 100 * n.protein_g) / max(m.m_servings) as c_protein,
           bool_or(l.ingredient_id = any (v_avoid)) as c_avoid,
           bool_or(l.ingredient_id in (select e.ingredient_id from expiring e)) as c_expiring
    from meals m
    cross join lateral private.recipe_lines(m.m_recipe, m.m_servings, v_user, m.meal_id) l
    join public.ingredients i on i.id = l.ingredient_id
    left join public.ingredient_nutrition n on n.ingredient_id = l.ingredient_id
    left join lateral private.ingredient_price(l.ingredient_id, v_region) pr on true
    where not l.is_optional
    group by m.meal_id
  ),
  opt as (
    select m.meal_id, e.id as o_recipe, e.title as o_title, e.total_minutes as o_minutes,
           sum(l.grams / 1000 * pr.price_per_kg) as o_cost,
           bool_and(pr.price_per_kg is not null or i.is_staple) as o_complete,
           sum(l.grams / 100 * n.protein_g) / max(m.m_servings) as o_protein,
           bool_or(l.ingredient_id = any (v_avoid)) as o_avoid,
           bool_or(l.ingredient_id in (select x.ingredient_id from expiring x)) as o_expiring,
           avg((i.is_staple or private.in_pantry(v_user, l.ingredient_id))::int) as o_coverage
    from meals m
    cross join lateral public.eligible_recipes(m.m_slot) e
    cross join lateral private.recipe_lines(e.id, m.m_servings, v_user, null) l
    join public.ingredients i on i.id = l.ingredient_id
    left join public.ingredient_nutrition n on n.ingredient_id = l.ingredient_id
    left join lateral private.ingredient_price(l.ingredient_id, v_region) pr on true
    where e.id <> m.m_recipe and not l.is_optional
    group by m.meal_id, e.id, e.title, e.total_minutes
  ),
  pairs as (
    select m.*, c.c_cost, c.c_complete, c.c_protein, c.c_expiring,
           o.o_recipe, o.o_title, o.o_minutes, o.o_cost, o.o_complete, o.o_protein, o.o_expiring, o.o_coverage,
           c.c_avoid as must_change,
           case p_goal
             when 'cheaper' then case when c.c_complete and o.o_complete then round(c.c_cost) - round(o.o_cost) end
             when 'faster' then (m.m_minutes - o.o_minutes)::numeric
             when 'protein' then o.o_protein - c.c_protein
             when 'use_expiring' then case when o.o_expiring and not c.c_expiring then 1 else 0 end
             when 'variety' then case when m.m_repeat > 1 then 1 else 0 end
             else 0
           end as score
    from meals m
    join cur c on c.meal_id = m.meal_id
    join opt o on o.meal_id = m.meal_id
    where not o.o_avoid
      -- Variedad: la alternativa no puede estar ya en el plan (con otra meta, al menos no el día de al lado).
      -- Lo que hay que EVITAR manda sobre la variedad: esas comidas aceptan una receta que ya esté en el plan.
      and (c.c_avoid
           or not exists (select 1 from public.planned_meals pm2
                          where pm2.plan_id = p_plan_id and pm2.recipe_id = o.o_recipe and pm2.status <> 'skipped'
                            and (p_goal = 'variety' or abs(pm2.meal_date - m.m_date) <= 1)))
  ),
  qualifying as (
    select * from pairs p
    where p.must_change
       or (p_goal = 'cheaper' and p.score >= 500)            -- menos de $500 no vale el cambio (igual que US-152)
       or (p_goal = 'faster' and p.score >= 10)              -- al menos 10 minutos menos
       or (p_goal = 'protein' and p.score >= 5)              -- al menos 5 g más de proteína por porción
       or (p_goal in ('use_expiring', 'variety') and p.score > 0)
  ),
  -- Cada alternativa se propone una sola vez (donde más sirve) y cada comida recibe su mejor opción. Las comidas
  -- que hay que cambiar por algo a evitar pueden repetir alternativa: ninguna debe quedar con ese ingrediente.
  one_per_alt as (
    select q.*, case when q.must_change then 1
                     else row_number() over (partition by q.o_recipe, q.must_change
                                             order by q.score desc nulls last, q.o_coverage desc, q.m_date) end as rn
    from qualifying q
  ),
  best as (
    select distinct on (a.meal_id) a.* from one_per_alt a where a.rn = 1
    order by a.meal_id, a.score desc nulls last, a.o_coverage desc, a.o_cost nulls last
  )
  select x.* from (
    select b.meal_id, b.m_date, b.m_slot, b.m_recipe, b.m_title,
           case when b.c_complete then round(b.c_cost) end, b.m_minutes::int,
           b.o_recipe, b.o_title,
           case when b.o_complete then round(b.o_cost) end, b.o_minutes::int,
           case when b.c_complete and b.o_complete then round(b.c_cost) - round(b.o_cost) end,
           case when b.must_change then 'avoid' else p_goal end
    from best b
    union all
    -- Comidas con algo a evitar para las que no hay ninguna receta segura sin eso: se dice, no se calla.
    select m.meal_id, m.m_date, m.m_slot, m.m_recipe, m.m_title, null, m.m_minutes::int,
           null, null, null, null, null, 'avoid_unresolved'
    from meals m join cur c on c.meal_id = m.meal_id
    where c.c_avoid and not exists (select 1 from best b where b.meal_id = m.meal_id)
  ) x
  order by 2, 3
  limit least(greatest(coalesce(p_limit, 10), 1), 93);
end $$;

-- Aplica los cambios elegidos de una vez. Cada uno debe ser una comida pendiente del plan de la persona y una
-- receta del conjunto seguro de ese momento del día; el trigger lo vuelve a validar al actualizar.
create function public.apply_week_changes(p_plan_id uuid, p_changes jsonb)
returns integer
language plpgsql set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_n    integer := 0;
  c      record;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not exists (select 1 from public.meal_plans mp where mp.id = p_plan_id and mp.user_id = v_user) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) not between 1 and 93 then
    raise exception 'invalid_changes: entre 1 y 93 cambios' using errcode = '22023';
  end if;
  if (select count(distinct x ->> 'planned_meal_id') from jsonb_array_elements(p_changes) x) <> jsonb_array_length(p_changes) then
    raise exception 'invalid_changes: una comida aparece dos veces' using errcode = '22023';
  end if;

  for c in
    select (x ->> 'planned_meal_id')::uuid as meal_id, (x ->> 'recipe_id')::uuid as recipe_id
    from jsonb_array_elements(p_changes) x
  loop
    perform 1 from public.planned_meals pm
    where pm.id = c.meal_id and pm.plan_id = p_plan_id and pm.status = 'planned' and not pm.is_extra
    for update;
    if not found then
      raise exception 'meal_not_found: una de las comidas ya no se puede cambiar' using errcode = 'P0002';
    end if;
    if not exists (select 1 from public.eligible_recipes((select pm.slot from public.planned_meals pm where pm.id = c.meal_id)) e
                   where e.id = c.recipe_id) then
      raise exception 'not_eligible: una receta no cumple tus restricciones' using errcode = 'P0001';
    end if;
    update public.planned_meals
       set replaced_recipe_id = recipe_id, recipe_id = c.recipe_id, reason_code = 'user_request', reason_ingredient_id = null
     where id = c.meal_id and recipe_id <> c.recipe_id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

revoke all on function public.propose_week_changes(uuid, text, uuid[], integer) from public, anon;
revoke all on function public.apply_week_changes(uuid, jsonb) from public, anon;
grant execute on function public.propose_week_changes(uuid, text, uuid[], integer) to authenticated, service_role;
grant execute on function public.apply_week_changes(uuid, jsonb) to authenticated, service_role;
