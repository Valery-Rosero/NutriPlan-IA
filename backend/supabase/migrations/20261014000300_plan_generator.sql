-- =============================================================================
-- 0016 · Sprint 4: generador de plan semanal (ADR-018, ADR-023) y cocinar una comida del plan
-- =============================================================================

-- ---- Regenerar sin perder historial -------------------------------------------
-- Antes: los borradores que se cruzaban con las fechas se borraban. Ahora, si tienen comidas ya
-- cocinadas (p. ej. creadas con "Cocinar ahora"), se ARCHIVAN: el historial y lo calificado se conservan.
create or replace function public.save_generated_plan(p_start date, p_end date, p_meals jsonb, p_budget_limit numeric default null)
returns uuid
language plpgsql set search_path = '' as $$
declare
  v_user  uuid := (select auth.uid());
  v_size  smallint;
  v_plan  uuid;
  v_pm    uuid;
  m       jsonb;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_meals is null or jsonb_typeof(p_meals) <> 'array' or jsonb_array_length(p_meals) = 0 then
    raise exception 'invalid_meals: el plan no tiene comidas' using errcode = '22023';
  end if;
  if exists (select 1 from public.meal_plans mp
             where mp.user_id = v_user and mp.status = 'confirmed'
               and daterange(mp.start_date, mp.end_date, '[]') && daterange(p_start, p_end, '[]')) then
    raise exception 'plan_overlap_confirmed: ya tienes un plan confirmado para esas fechas' using errcode = 'P0001';
  end if;

  delete from public.meal_plans mp
  where mp.user_id = v_user and mp.status = 'draft'
    and daterange(mp.start_date, mp.end_date, '[]') && daterange(p_start, p_end, '[]')
    and not exists (select 1 from public.planned_meals pm where pm.plan_id = mp.id and pm.status = 'cooked');
  update public.meal_plans mp set status = 'archived'
  where mp.user_id = v_user and mp.status = 'draft'
    and daterange(mp.start_date, mp.end_date, '[]') && daterange(p_start, p_end, '[]');

  select p.household_size into v_size from public.profiles p where p.id = v_user;
  insert into public.meal_plans (user_id, start_date, end_date, budget_limit)
  values (v_user, p_start, p_end, p_budget_limit) returning id into v_plan;

  for m in select x from jsonb_array_elements(p_meals) x loop
    insert into public.planned_meals (plan_id, meal_date, slot, recipe_id, servings, reason_code, reason_ingredient_id)
    values (v_plan, (m ->> 'meal_date')::date, (m ->> 'slot')::public.meal_slot, (m ->> 'recipe_id')::uuid,
            coalesce((m ->> 'servings')::numeric, v_size), m ->> 'reason_code', nullif(m ->> 'reason_ingredient_id', '')::uuid)
    returning id into v_pm;
    insert into public.planned_meal_choices (planned_meal_id, recipe_id, group_key, ingredient_id)
    select v_pm, (m ->> 'recipe_id')::uuid, (c ->> 'group_key')::smallint, (c ->> 'ingredient_id')::uuid
    from jsonb_array_elements(coalesce(m -> 'choices', '[]'::jsonb)) c;
  end loop;
  return v_plan;
end $$;

-- ---- Generador determinista (US-117, US-139, US-145, US-146, US-155) -------------
-- Solo elige entre eligible_recipes (alergias y dietas ya filtradas). Puntaje por comida:
--   cobertura de la despensa ×50 · usa algo por vencer +25 · cocina favorita +10
--   − 30 por cada vez que ya está en el plan · − 60 si se usó ayer u hoy (variedad)
--   + desempate pseudoaleatorio estable (cambia por fecha y momento, no entre recargas).
-- El motivo (reason_code) es la regla que más pesó: siempre verdadero (US-155).
create function public.generate_plan(p_start date default current_date, p_days integer default 7,
                                     p_slots public.meal_slot[] default array['breakfast', 'lunch', 'dinner']::public.meal_slot[])
returns uuid
language plpgsql set search_path = '' as $$
declare
  v_user  uuid := (select auth.uid());
  v_meals jsonb := '[]'::jsonb;
  v_day   date;
  s       public.meal_slot;
  v_pick  record;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_days is null or p_days not between 1 and 14 then
    raise exception 'invalid_days: el plan dura entre 1 y 14 días' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_slots), 0) = 0 then
    raise exception 'invalid_slots: elige al menos un momento del día' using errcode = '22023';
  end if;

  for d in 0 .. p_days - 1 loop
    v_day := p_start + d;
    foreach s in array p_slots loop
      -- lo que ya se cocinó ese día y momento no se vuelve a planear
      continue when exists (select 1 from public.planned_meals pm join public.meal_plans mp on mp.id = pm.plan_id
                            where mp.user_id = v_user and pm.meal_date = v_day and pm.slot = s and pm.status = 'cooked');

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
        select count(*) filter (where m ->> 'recipe_id' = e.id::text) as uses,
               coalesce(bool_or(m ->> 'recipe_id' = e.id::text and (m ->> 'meal_date')::date >= v_day - 1), false) as recent
        from jsonb_array_elements(v_meals) m) rep
      cross join lateral (
        select cov.coverage * 50
               + case when ex.expiring then 25 else 0 end
               + case when cu.fav then 10 else 0 end
               - rep.uses * 30
               - case when rep.recent then 60 else 0 end
               + abs(hashtext(e.id::text || v_day::text || s::text)) % 13 as score,
               case when ex.expiring then 'pantry_expiring'
                    when cov.coverage >= 0.5 then 'pantry_match'
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

-- ---- Cocinar una comida del plan con las opciones elegidas (atómico) ------------
create function public.cook_planned_meal(p_planned_meal_id uuid, p_choices jsonb default '[]'::jsonb)
returns jsonb
language plpgsql set search_path = '' as $$
declare v_pm public.planned_meals;
begin
  select pm.* into v_pm
  from public.planned_meals pm join public.meal_plans p on p.id = pm.plan_id
  where pm.id = p_planned_meal_id and p.user_id = (select auth.uid());
  if not found then
    raise exception 'meal_not_found' using errcode = 'P0002';
  end if;
  if jsonb_array_length(coalesce(p_choices, '[]'::jsonb)) > 0 then
    delete from public.planned_meal_choices where planned_meal_id = v_pm.id;
    insert into public.planned_meal_choices (planned_meal_id, recipe_id, group_key, ingredient_id)
    select v_pm.id, v_pm.recipe_id, (x ->> 'group_key')::smallint, (x ->> 'ingredient_id')::uuid
    from jsonb_array_elements(p_choices) x;
  end if;
  return public.mark_meal_cooked(v_pm.id);
end $$;

revoke execute on function public.generate_plan(date, integer, public.meal_slot[]), public.cook_planned_meal(uuid, jsonb)
  from public, anon;
grant execute on function public.generate_plan(date, integer, public.meal_slot[]), public.cook_planned_meal(uuid, jsonb)
  to authenticated, service_role;
