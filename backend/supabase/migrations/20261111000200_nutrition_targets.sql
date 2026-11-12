-- US-159 (resumen nutricional del día) y US-136 (objetivo de proteína).
-- Las metas de calorías y proteína son datos sensibles como las dietas (ADR-011): solo con la autorización
-- expresa; al revocarla se borran. Todo es informativo: sin lenguaje de recomendación médica.

-- ---- Metas: solo con autorización de datos sensibles -----------------------------------------------
create function private.require_sensitive_for_targets()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.target_protein_pct is not null and new.target_protein_pct is distinct from old.target_protein_pct)
     or (new.daily_kcal_target is not null and new.daily_kcal_target is distinct from old.daily_kcal_target) then
    if not private.has_consent(new.id, 'sensitive_data_authorization') then
      raise exception 'sensitive_authorization_required: se necesita tu autorización expresa para tratar datos de salud y dietas'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_targets_sensitive_auth before update of target_protein_pct, daily_kcal_target on public.profiles
  for each row execute function private.require_sensitive_for_targets();

-- Al revocar la autorización, las metas se borran junto con alergias, dietas y salud.
create function private.purge_targets_on_revoke()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.revoked_at is not null and old.revoked_at is null
     and exists (select 1 from public.legal_documents ld where ld.id = new.document_id and ld.kind = 'sensitive_data_authorization') then
    update public.profiles set target_protein_pct = null, daily_kcal_target = null where id = new.user_id;
  end if;
  return new;
end $$;

create trigger user_consents_purge_targets after update of revoked_at on public.user_consents
  for each row execute function private.purge_targets_on_revoke();

-- ---- US-159 · Mi día: nutrición por porción de las comidas del día ----------------------------------
-- Una fila por comida (cocinada o pendiente; las omitidas no cuentan). Por PORCIÓN, con la versión que se
-- cocinó (opciones elegidas). Las cocinadas valen de cualquier plan; las pendientes, solo de planes vigentes.
-- La app suma solo las cocinadas: lo pendiente se muestra como "pendiente", nunca como 0.
create function public.daily_nutrition(p_date date default (now() at time zone 'America/Bogota')::date)
returns table (planned_meal_id uuid, slot public.meal_slot, title text, status public.meal_status,
               kcal numeric, protein_g numeric, carbs_g numeric, fat_g numeric)
language sql stable set search_path = '' as $$
  select pm.id, pm.slot, r.title, pm.status,
         round(sum(l.grams / 100 * n.kcal)      / pm.servings),
         round(sum(l.grams / 100 * n.protein_g) / pm.servings, 1),
         round(sum(l.grams / 100 * n.carbs_g)   / pm.servings, 1),
         round(sum(l.grams / 100 * n.fat_g)     / pm.servings, 1)
  from public.planned_meals pm
  join public.meal_plans mp on mp.id = pm.plan_id
  join public.recipes r on r.id = pm.recipe_id
  cross join lateral private.recipe_lines(pm.recipe_id, pm.servings, (select auth.uid()), pm.id) l
  left join public.ingredient_nutrition n on n.ingredient_id = l.ingredient_id
  where mp.user_id = (select auth.uid()) and pm.meal_date = p_date and not l.is_optional
    and (pm.status = 'cooked' or (pm.status = 'planned' and mp.status <> 'archived'))
  group by pm.id, pm.slot, r.title, pm.status, pm.servings
  order by array_position(array['breakfast', 'lunch', 'snack', 'dinner']::public.meal_slot[], pm.slot)
$$;

revoke execute on function public.daily_nutrition(date) from public, anon;
grant execute on function public.daily_nutrition(date) to authenticated, service_role;

-- ---- US-136 · El generador prefiere (no exige) recetas que encajan con el objetivo de proteína -------
-- Preferencia BLANDA (+20, motivo macro_fit), no un mínimo obligatorio: medido en el catálogo real (nov. 2026),
-- solo 1 de 16 recetas pasa de 35 % de kcal desde proteína (Sudado, 37 %); las demás van de 4 % a 23 %.
-- Exigirlo dejaría el plan sin desayunos y con una sola receta de almuerzo/cena. Las alergias y dietas
-- siguen siendo el único filtro duro (eligible_recipes).
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
