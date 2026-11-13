-- Platos adicionales del día: lo que se cocina FUERA del plan (una receta que sugirió el asistente, o una
-- sugerencia de "¿Qué cocino?") se SUMA al día; ya no reemplaza la comida planeada de ese momento.
-- Antes, cook_now pisaba el almuerzo planeado con el batido, o fallaba ("ya registraste una comida") si
-- ese momento ya estaba cocinado.
--
-- Se guardan en planned_meals marcados con is_extra: así cocinar (descontar despensa), deshacer, calificar,
-- Mi día (daily_nutrition), exportar y avisos funcionan sin duplicar lógica. Un adicional siempre queda
-- cocinado (o se borra al deshacer). Solo cambian las funciones que asumían "una comida por momento":
-- cook_now, generate_plan, plan_budget_status y undo_meal_cooked (copias exactas + el ajuste marcado).

alter table public.planned_meals add column is_extra boolean not null default false;
comment on column public.planned_meals.is_extra is
  'Plato adicional del día (cocinado fuera del plan). No ocupa el momento del día, no cuenta en el costo del plan y al deshacerlo se borra.';

-- Una comida PLANEADA por momento del día; los adicionales no cuentan para esa regla.
alter table public.planned_meals drop constraint planned_meals_plan_id_meal_date_slot_key;
create unique index planned_meals_one_per_slot on public.planned_meals (plan_id, meal_date, slot) where not is_extra;

create or replace function public.cook_now(p_recipe_id uuid, p_slot public.meal_slot, p_servings numeric,
                                           p_choices jsonb default '[]'::jsonb)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_plan uuid;
  v_pm   uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- El adicional se guarda en el plan que cubre hoy; si no hay, en uno de un día (la app no lo muestra
  -- como plan porque no tiene comidas planeadas).
  select mp.id into v_plan from public.meal_plans mp
  where mp.user_id = v_user and mp.status <> 'archived' and current_date between mp.start_date and mp.end_date
  order by mp.start_date desc limit 1;
  if v_plan is null then
    insert into public.meal_plans (user_id, start_date, end_date) values (v_user, current_date, current_date)
    returning id into v_plan;
  end if;

  -- Siempre se SUMA: nunca reemplaza la comida planeada de ese momento del día.
  insert into public.planned_meals (plan_id, meal_date, slot, recipe_id, servings, reason_code, is_extra)
  values (v_plan, current_date, p_slot, p_recipe_id, p_servings, 'user_request', true)
  returning id into v_pm;

  insert into public.planned_meal_choices (planned_meal_id, recipe_id, group_key, ingredient_id)
  select v_pm, p_recipe_id, (x ->> 'group_key')::smallint, (x ->> 'ingredient_id')::uuid
  from jsonb_array_elements(coalesce(p_choices, '[]'::jsonb)) x;

  return public.mark_meal_cooked(v_pm);
end $$;

create or replace function public.generate_plan(p_start date default current_date, p_days integer default 7,
                                     p_slots public.meal_slot[] default array['breakfast', 'lunch', 'dinner']::public.meal_slot[])
returns uuid
language plpgsql set search_path = '' as $$
declare
  v_user  uuid := (select auth.uid());
  v_meals jsonb := '[]'::jsonb;
  v_day   date;
  s       public.meal_slot;
  v_pick  record;
  v_protein smallint := (select p.target_protein_pct from public.profiles p where p.id = (select auth.uid()));
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_days is null or p_days not between 1 and 31 then
    raise exception 'invalid_days: el plan dura entre 1 y 31 días' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_slots), 0) = 0 then
    raise exception 'invalid_slots: elige al menos un momento del día' using errcode = '22023';
  end if;

  for d in 0 .. p_days - 1 loop
    v_day := p_start + d;
    foreach s in array p_slots loop
      -- lo que ya se cocinó ese día y momento no se vuelve a planear
      continue when exists (select 1 from public.planned_meals pm join public.meal_plans mp on mp.id = pm.plan_id
                            where mp.user_id = v_user and pm.meal_date = v_day and pm.slot = s and pm.status = 'cooked'
                              and not pm.is_extra);  -- un adicional (batido) no ocupa el almuerzo

      select e.id, sc.score, sc.reason into v_pick
      from public.eligible_recipes(s) e
      cross join lateral (select m.coverage from public.recipe_pantry_match(e.id) m) cov
      cross join lateral (
        select exists (
          select 1 from public.pantry_items pi
          where pi.user_id = v_user and pi.quantity_g > 0
            and pi.expires_on between current_date and current_date + 3
            and (exists (select 1 from public.recipe_ingredients ri where ri.recipe_id = e.id and ri.ingredient_id = pi.ingredient_id)
                 or exists (select 1 from public.recipe_flex_options o where o.recipe_id = e.id and o.ingredient_id = pi.ingredient_id))
        ) as expiring) ex
      cross join lateral (
        select exists (select 1 from public.user_cuisines uc where uc.user_id = v_user and uc.cuisine_id = e.cuisine_id) as fav) cu
      cross join lateral (
        select coalesce(avg(rr.rating), 0) >= 4 as liked
        from public.recipe_ratings rr where rr.user_id = v_user and rr.recipe_id = e.id) lk
      cross join lateral (
        -- US-136: con objetivo de proteína, sube lo que aporta al menos (objetivo − 5) % de kcal desde proteína.
        select v_protein is not null and n.kcal_per_serving > 0
               and n.protein_g_per_serving * 4 * 100 / n.kcal_per_serving >= v_protein - 5 as fits
        from public.recipe_nutrition n where n.recipe_id = e.id) mf
      cross join lateral (
        select count(*) filter (where m ->> 'recipe_id' = e.id::text) as uses,
               coalesce(bool_or(m ->> 'recipe_id' = e.id::text and (m ->> 'meal_date')::date >= v_day - 1), false) as recent
        from jsonb_array_elements(v_meals) m) rep
      cross join lateral (
        select cov.coverage * 50
               + case when ex.expiring then 25 else 0 end
               + case when cu.fav then 20 else 0 end   -- US-138: antes +10; ahora pesa casi como lo que vence
               + case when lk.liked then 15 else 0 end
               + case when coalesce(mf.fits, false) then 20 else 0 end
               - rep.uses * 30
               - case when rep.recent then 60 else 0 end
               + abs(hashtext(e.id::text || v_day::text || s::text)) % 13 as score,
               case when ex.expiring then 'pantry_expiring'
                    when cov.coverage >= 0.5 then 'pantry_match'
                    when lk.liked then 'high_rating'
                    when coalesce(mf.fits, false) then 'macro_fit'
                    when cu.fav then 'cuisine_favorite'
                    else 'variety' end as reason) sc
      order by sc.score desc, e.title
      limit 1;

      if found then
        v_meals := v_meals || jsonb_build_array(jsonb_build_object(
          'meal_date', v_day, 'slot', s, 'recipe_id', v_pick.id, 'reason_code', v_pick.reason));
      end if;
    end loop;
  end loop;

  if jsonb_array_length(v_meals) = 0 then
    raise exception 'no_eligible_recipes: no hay recetas que cumplan tus restricciones' using errcode = 'P0001';
  end if;
  return public.save_generated_plan(p_start, p_start + p_days - 1, v_meals);
end $$;

create or replace function public.plan_budget_status(p_plan_id uuid)
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
  with priced as (
    select l.grams, pr.price_per_kg, pr.is_estimated
    from public.planned_meals pm
    cross join lateral private.recipe_lines(pm.recipe_id, pm.servings, v_user, pm.id) l
    left join lateral private.ingredient_price(l.ingredient_id, v_region) pr on true
    where pm.plan_id = p_plan_id and pm.status <> 'skipped' and not pm.is_extra and not l.is_optional
  ),
  total as (select coalesce(round(sum(grams / 1000 * price_per_kg), 2), 0) as cost,
                   (count(*) filter (where price_per_kg is null))::int as missing,
                   (count(*) filter (where is_estimated))::int as estimated
            from priced)
  select t.cost, v_limit,
         case when v_limit is null then null else greatest(t.cost - v_limit, 0) end,
         (select c.currency_code from public.regions rg join public.countries c on c.code = rg.country_code where rg.id = v_region)::char(3),
         t.missing, t.estimated
  from total t;
end $$;

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
  if v_pm.is_extra then
    -- Un adicional solo existe porque se cocinó: deshacerlo lo quita (no queda "pendiente").
    delete from public.planned_meals where id = p_planned_meal_id;
  else
    update public.planned_meals set status = 'planned', cooked_at = null where id = p_planned_meal_id;
    delete from public.planned_meal_choices where planned_meal_id = p_planned_meal_id and is_auto;
  end if;
end $$;
