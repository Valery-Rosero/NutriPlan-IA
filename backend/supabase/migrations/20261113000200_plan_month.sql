-- B2: planear por día, semana o MES. El generador pasa de 1–14 a 1–31 días; el resto queda igual
-- (misma puntuación, mismas reglas de seguridad, mismo guardado atómico con save_generated_plan).
-- Copia exacta de la versión de 20261111000200_nutrition_targets.sql salvo el límite de días.

-- Un plan puede cubrir hasta 31 días (antes 14). Sigue sin poder empezar después de terminar.
alter table public.meal_plans drop constraint meal_plans_check;
alter table public.meal_plans add constraint meal_plans_check
  check (end_date >= start_date and end_date - start_date <= 30);

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
