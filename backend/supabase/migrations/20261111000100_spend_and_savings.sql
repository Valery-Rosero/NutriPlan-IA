-- US-141 (gasto del mes frente al presupuesto) y US-152 (reemplazos para ahorrar).

-- ---- US-141 · Registrar lo pagado ----------------------------------------------------------------
-- Se registra al pasar lo comprado a la despensa: lo que la persona pagó de verdad (purchases.total_amount),
-- no una suma de precios estimados. La lista, si viene, debe ser propia.
create function public.record_purchase(p_total numeric, p_list_id uuid default null, p_store text default null)
returns uuid
language plpgsql set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_id   uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_total is null or p_total <= 0 or p_total > 100000000 then
    raise exception 'invalid_amount: escribe cuánto pagaste' using errcode = '22023';
  end if;
  if p_list_id is not null and not exists (select 1 from public.shopping_lists l where l.id = p_list_id and l.user_id = v_user) then
    raise exception 'list_not_found' using errcode = 'P0002';
  end if;
  insert into public.purchases (user_id, shopping_list_id, total_amount, store_name)
  values (v_user, p_list_id, round(p_total), nullif(trim(p_store), ''))
  returning id into v_id;
  return v_id;
end $$;

-- ---- US-141 · Gasto del mes ---------------------------------------------------------------------
-- Mes calendario en hora de Colombia. Presupuesto mensual: el mensual tal cual; el semanal se lleva al mes
-- (monto × días del mes ÷ 7) para comparar peras con peras.
create function public.monthly_spend(p_month date default (now() at time zone 'America/Bogota')::date)
returns table (month_start date, spent numeric, purchases integer, monthly_budget numeric, percent integer)
language sql stable set search_path = '' as $$
  with bounds as (
    select date_trunc('month', p_month)::date as m0,
           (date_trunc('month', p_month) + interval '1 month')::date as m1
  ),
  me as (
    select p.budget_amount, p.budget_period from public.profiles p where p.id = (select auth.uid())
  ),
  spent as (
    select coalesce(sum(pu.total_amount), 0) as total, count(*)::int as n
    from public.purchases pu, bounds b
    where pu.user_id = (select auth.uid()) and pu.purchased_on >= b.m0 and pu.purchased_on < b.m1
  ),
  budget as (
    select case me.budget_period
             when 'month' then me.budget_amount
             when 'week'  then round(me.budget_amount * (b.m1 - b.m0) / 7.0)
           end as amount
    from me, bounds b
  )
  select b.m0, s.total, s.n, bu.amount,
         case when bu.amount > 0 then round(s.total * 100 / bu.amount)::int end
  from bounds b, spent s, budget bu
$$;

-- ---- US-152 · Reemplazos para ahorrar --------------------------------------------------------------
-- Para cada comida pendiente del plan: la alternativa elegible (mismas reglas que un cambio manual) del mismo
-- momento del día con el menor costo, si ahorra. Solo se comparan recetas con TODOS sus precios conocidos
-- (salvo básicos como sal, aceite o agua, que no van a la lista de mercado): con precios faltantes el
-- "ahorro" sería inventado. Sugiere; aplicar es un cambio normal (lo valida el trigger).
create function public.plan_savings(p_plan_id uuid, p_limit integer default 5)
returns table (planned_meal_id uuid, meal_date date, slot public.meal_slot,
               current_recipe_id uuid, current_title text, current_cost numeric,
               alternative_recipe_id uuid, alternative_title text, alternative_cost numeric, saving numeric)
language plpgsql stable set search_path = '' as $$
#variable_conflict use_column
declare
  v_user   uuid := (select auth.uid());
  v_region smallint;
begin
  select p.region_id into v_region from public.profiles p where p.id = v_user;
  if v_region is null then
    raise exception 'region_required: elige tu región para estimar costos' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.meal_plans mp where mp.id = p_plan_id and mp.user_id = v_user) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;

  return query
  with meals as (
    select pm.id, pm.meal_date, pm.slot, pm.recipe_id, pm.servings, r.title
    from public.planned_meals pm join public.recipes r on r.id = pm.recipe_id
    where pm.plan_id = p_plan_id and pm.status = 'planned'
  ),
  current_cost as (
    select m.id, sum(l.grams / 1000 * pr.price_per_kg) as cost, bool_and(pr.price_per_kg is not null or i.is_staple) as complete
    from meals m
    cross join lateral private.recipe_lines(m.recipe_id, m.servings, v_user, m.id) l
    join public.ingredients i on i.id = l.ingredient_id
    left join lateral private.ingredient_price(l.ingredient_id, v_region) pr on true
    where not l.is_optional
    group by m.id
  ),
  options as (
    select m.id as meal_id, e.id as recipe_id, e.title,
           sum(l.grams / 1000 * pr.price_per_kg) as cost, bool_and(pr.price_per_kg is not null or i.is_staple) as complete
    from meals m
    cross join lateral public.eligible_recipes(m.slot) e
    cross join lateral private.recipe_lines(e.id, m.servings, v_user, null) l
    join public.ingredients i on i.id = l.ingredient_id
    left join lateral private.ingredient_price(l.ingredient_id, v_region) pr on true
    where e.id <> m.recipe_id and not l.is_optional
    group by m.id, e.id, e.title
  ),
  -- Pares (comida → alternativa) que ahorran, con ambos costos completos. Para no romper la variedad, la
  -- alternativa no puede estar ya en el plan ese día ni en los vecinos.
  pairs as (
    select m.id as meal_id, m.meal_date, m.slot, m.recipe_id as current_id, m.title as current_title,
           round(c.cost) as current_cost, o.recipe_id as alt_id, o.title as alt_title, round(o.cost) as alt_cost,
           round(c.cost) - round(o.cost) as saving
    from meals m
    join current_cost c on c.id = m.id and c.complete
    join options o on o.meal_id = m.id and o.complete
    where round(c.cost) - round(o.cost) >= 500   -- ahorros de menos de $500 no valen la pena el cambio
      and not exists (select 1 from public.planned_meals pm2
                      where pm2.plan_id = p_plan_id and pm2.recipe_id = o.recipe_id
                        and pm2.status <> 'skipped' and abs(pm2.meal_date - m.meal_date) <= 1)
  ),
  -- Cada alternativa se propone una sola vez (donde más ahorra) y cada comida recibe su mejor opción.
  one_per_alt as (
    select *, row_number() over (partition by alt_id order by saving desc, meal_date) as rn from pairs
  ),
  best as (
    select distinct on (meal_id) * from one_per_alt where rn = 1 order by meal_id, saving desc
  )
  -- El ahorro es la resta de los dos montos que ve la persona (redondeados), para que cuadre exacto.
  select b.meal_id, b.meal_date, b.slot, b.current_id, b.current_title, b.current_cost,
         b.alt_id, b.alt_title, b.alt_cost, b.saving
  from best b
  order by b.saving desc, b.meal_date, b.slot
  limit greatest(coalesce(p_limit, 5), 1);
end $$;

revoke execute on function public.record_purchase(numeric, uuid, text) from public, anon;
revoke execute on function public.monthly_spend(date) from public, anon;
revoke execute on function public.plan_savings(uuid, integer) from public, anon;
grant execute on function public.record_purchase(numeric, uuid, text) to authenticated, service_role;
grant execute on function public.monthly_spend(date) to authenticated, service_role;
grant execute on function public.plan_savings(uuid, integer) to authenticated, service_role;
