-- =============================================================================
-- 0015 · Sprint 3: vista previa de una receta con las opciones que elige la persona y "Cocinar ahora"
-- La resolución de grupos acepta elecciones ad hoc (jsonb) además de las guardadas en un plan.
-- =============================================================================

-- ---- Resolución con elecciones ad hoc ----------------------------------------
-- p_choices: [{group_key, ingredient_id}]. Se ignoran las que no son opción de la receta o que la
-- persona no puede comer (alergia/dieta): ese grupo se resuelve solo, con opciones seguras.
create function private.resolve_flex_choices(p_recipe_id uuid, p_user_id uuid, p_planned_meal_id uuid,
                                             p_choices jsonb)
returns table (group_key smallint, ingredient_id uuid, share numeric)
language sql stable security definer set search_path = '' as $$
  with grp as (
    select g.group_key, g.min_choices, g.max_choices
    from public.recipe_flex_groups g where g.recipe_id = p_recipe_id
  ),
  requested as (
    select c.group_key, c.ingredient_id
    from public.planned_meal_choices c
    where p_planned_meal_id is not null and c.planned_meal_id = p_planned_meal_id and c.recipe_id = p_recipe_id
    union
    select (x ->> 'group_key')::smallint, (x ->> 'ingredient_id')::uuid
    from jsonb_array_elements(case when p_planned_meal_id is null then coalesce(p_choices, '[]'::jsonb) else '[]'::jsonb end) x
  ),
  explicit as (
    select r.group_key, r.ingredient_id
    from requested r
    join public.recipe_flex_options o
      on o.recipe_id = p_recipe_id and o.group_key = r.group_key and o.ingredient_id = r.ingredient_id
    where p_user_id is null or not private.ingredient_blocked_for_user(r.ingredient_id, p_user_id)
  ),
  cand as (
    select o.group_key, o.ingredient_id, o.is_default, i.name,
           (p_user_id is not null and st.grams > 0) as in_pantry, st.first_expiry,
           exists (select 1 from public.user_disliked_ingredients d
                   where d.user_id = p_user_id and d.ingredient_id = o.ingredient_id) as disliked
    from public.recipe_flex_options o
    join public.ingredients i on i.id = o.ingredient_id
    cross join lateral (
      select coalesce(sum(pi.quantity_g), 0) as grams, min(pi.expires_on) as first_expiry
      from public.pantry_items pi
      where pi.user_id = p_user_id and pi.ingredient_id = o.ingredient_id and pi.quantity_g > 0
        and (pi.expires_on is null or pi.expires_on >= current_date)
    ) st
    where o.recipe_id = p_recipe_id
      and not exists (select 1 from explicit e where e.group_key = o.group_key)
      and (p_user_id is null or not private.ingredient_blocked_for_user(o.ingredient_id, p_user_id))
  ),
  ranked as (
    select c.group_key, c.ingredient_id,
           row_number() over (partition by c.group_key
                              order by c.in_pantry desc, c.first_expiry nulls last, c.disliked, c.is_default desc, c.name) as rn,
           count(*) filter (where c.in_pantry) over (partition by c.group_key) as n_pantry
    from cand c
  ),
  picked as (
    select r.group_key, r.ingredient_id
    from ranked r join grp g on g.group_key = r.group_key
    where r.rn <= greatest(g.min_choices, least(r.n_pantry, g.max_choices))
    union all
    select e.group_key, e.ingredient_id from explicit e
  )
  select p.group_key, p.ingredient_id, round(1.0 / count(*) over (partition by p.group_key), 4)
  from picked p
$$;

-- La función original delega (misma firma: las vistas que dependen de ella no cambian).
create or replace function private.resolve_flex(p_recipe_id uuid, p_user_id uuid, p_planned_meal_id uuid default null)
returns table (group_key smallint, ingredient_id uuid, share numeric)
language sql stable security definer set search_path = '' as $$
  select * from private.resolve_flex_choices(p_recipe_id, p_user_id, p_planned_meal_id, null)
$$;

create function private.recipe_lines_choices(p_recipe_id uuid, p_servings numeric, p_user_id uuid,
                                             p_planned_meal_id uuid, p_choices jsonb)
returns table (ingredient_id uuid, ingredient_name text, is_optional boolean, quantity numeric,
               unit_id smallint, unit_code text, grams numeric, group_key smallint, group_label text)
language plpgsql stable set search_path = '' as $$
declare v_base smallint;
begin
  if p_servings is null or p_servings <= 0 then
    raise exception 'invalid_servings: las porciones deben ser mayores que 0' using errcode = '22023';
  end if;
  select r.base_servings into v_base from public.recipes r where r.id = p_recipe_id;
  if not found then
    raise exception 'recipe_not_found' using errcode = 'P0002';
  end if;

  return query
  with lines as (
    select ri.ingredient_id, ri.is_optional, ri.quantity, ri.unit_id, ri.scaling_exponent,
           ri.sort_order::int as sort_key, null::smallint as group_key, null::text as group_label
    from public.recipe_ingredients ri where ri.recipe_id = p_recipe_id
    union all
    select o.ingredient_id, false, o.quantity * rf.share, o.unit_id, o.scaling_exponent,
           1000 + g.sort_order * 10 + g.group_key, g.group_key, g.label
    from private.resolve_flex_choices(p_recipe_id, p_user_id, p_planned_meal_id, p_choices) rf
    join public.recipe_flex_options o on o.recipe_id = p_recipe_id and o.group_key = rf.group_key
                                     and o.ingredient_id = rf.ingredient_id
    join public.recipe_flex_groups g  on g.recipe_id = p_recipe_id and g.group_key = rf.group_key
  )
  select l.ingredient_id, i.name, l.is_optional, q.qty, l.unit_id, u.code,
         round(private.to_grams(l.ingredient_id, q.qty, l.unit_id), 2), l.group_key, l.group_label
  from lines l
  join public.ingredients i on i.id = l.ingredient_id
  join public.units u       on u.id = l.unit_id
  cross join lateral (select coalesce(i.rounding_step, u.rounding_step) as s) st
  cross join lateral (
    select greatest(st.s, round(l.quantity * power(p_servings / v_base, l.scaling_exponent) / st.s) * st.s) as qty
  ) q
  order by l.sort_key, i.name;
end $$;

create or replace function private.recipe_lines(p_recipe_id uuid, p_servings numeric, p_user_id uuid,
                                                p_planned_meal_id uuid default null)
returns table (ingredient_id uuid, ingredient_name text, is_optional boolean, quantity numeric,
               unit_id smallint, unit_code text, grams numeric, group_key smallint, group_label text)
language plpgsql stable set search_path = '' as $$
begin
  return query select * from private.recipe_lines_choices(p_recipe_id, p_servings, p_user_id, p_planned_meal_id, null);
end $$;

-- ---- Vista previa (US-115, US-118) --------------------------------------------
-- Ingredientes escalados con las opciones elegidas, si cada uno está en la despensa, nutrición por porción
-- y alérgenos de lo resuelto. Todo se calcula aquí: la app nunca calcula cantidades (AGENTS.md regla 2).
create function public.preview_recipe(p_recipe_id uuid, p_servings numeric, p_choices jsonb default '[]'::jsonb)
returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_out  jsonb;
begin
  with lines as (
    select * from private.recipe_lines_choices(p_recipe_id, p_servings, v_user, null, p_choices)
  ),
  enriched as (
    select l.*, private.in_pantry(v_user, l.ingredient_id) as in_pantry, i.is_staple
    from lines l join public.ingredients i on i.id = l.ingredient_id
  ),
  nutrition as (
    select round(sum(e.grams / 100 * n.kcal)      / p_servings, 1) as kcal,
           round(sum(e.grams / 100 * n.protein_g) / p_servings, 1) as protein_g,
           round(sum(e.grams / 100 * n.carbs_g)   / p_servings, 1) as carbs_g,
           round(sum(e.grams / 100 * n.fat_g)     / p_servings, 1) as fat_g,
           round(sum(e.grams / 100 * n.fiber_g)   / p_servings, 1) as fiber_g,
           round(sum(e.grams / 100 * n.sugar_g)   / p_servings, 1) as sugar_g,
           round(sum(e.grams / 100 * n.sodium_mg) / p_servings, 0) as sodium_mg
    from enriched e join public.ingredient_nutrition n on n.ingredient_id = e.ingredient_id
    where not e.is_optional
  )
  select jsonb_build_object(
    'lines', coalesce((select jsonb_agg(jsonb_build_object(
                'ingredient_id', e.ingredient_id, 'ingredient_name', e.ingredient_name, 'quantity', e.quantity,
                'unit_code', e.unit_code, 'grams', e.grams, 'is_optional', e.is_optional, 'group_key', e.group_key,
                'group_label', e.group_label, 'in_pantry', e.in_pantry or e.is_staple))
              from enriched e), '[]'::jsonb),
    'per_serving', (select to_jsonb(n) from nutrition n),
    'allergens', coalesce((select jsonb_agg(distinct a.code order by a.code)
                           from enriched e
                           join public.ingredient_allergens ia on ia.ingredient_id = e.ingredient_id
                           join public.allergens a on a.id = ia.allergen_id), '[]'::jsonb))
  into v_out;
  return v_out;
end $$;

-- ---- Cocinar ahora (con lo que hay, sin plan previo) ---------------------------
-- Usa el plan que cubra hoy (o crea uno de un día), pone la receta en el momento del día indicado,
-- guarda las elecciones y descuenta la despensa con mark_meal_cooked (mismas validaciones de siempre).
create function public.cook_now(p_recipe_id uuid, p_slot public.meal_slot, p_servings numeric,
                                p_choices jsonb default '[]'::jsonb)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_plan uuid;
  v_pm   public.planned_meals;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select mp.id into v_plan from public.meal_plans mp
  where mp.user_id = v_user and mp.status <> 'archived' and current_date between mp.start_date and mp.end_date
  order by mp.start_date desc limit 1;
  if v_plan is null then
    insert into public.meal_plans (user_id, start_date, end_date) values (v_user, current_date, current_date)
    returning id into v_plan;
  end if;

  select pm.* into v_pm from public.planned_meals pm
  where pm.plan_id = v_plan and pm.meal_date = current_date and pm.slot = p_slot
  for update;
  if found and v_pm.status <> 'planned' then
    raise exception 'meal_not_pending: ya registraste una comida en este momento del día' using errcode = 'P0001';
  elsif found then
    update public.planned_meals
       set replaced_recipe_id = case when recipe_id <> p_recipe_id then recipe_id else replaced_recipe_id end,
           recipe_id = p_recipe_id, servings = p_servings, reason_code = 'user_request', reason_ingredient_id = null
     where id = v_pm.id;
    delete from public.planned_meal_choices where planned_meal_id = v_pm.id;
  else
    insert into public.planned_meals (plan_id, meal_date, slot, recipe_id, servings, reason_code)
    values (v_plan, current_date, p_slot, p_recipe_id, p_servings, 'user_request')
    returning * into v_pm;
  end if;

  insert into public.planned_meal_choices (planned_meal_id, recipe_id, group_key, ingredient_id)
  select v_pm.id, p_recipe_id, (x ->> 'group_key')::smallint, (x ->> 'ingredient_id')::uuid
  from jsonb_array_elements(coalesce(p_choices, '[]'::jsonb)) x;

  return public.mark_meal_cooked(v_pm.id);
end $$;

revoke execute on function public.preview_recipe(uuid, numeric, jsonb), public.cook_now(uuid, public.meal_slot, numeric, jsonb)
  from public, anon;
grant execute on function public.preview_recipe(uuid, numeric, jsonb), public.cook_now(uuid, public.meal_slot, numeric, jsonb)
  to authenticated, service_role;
