-- ADR-039 · Semana y mes con IA (propuesta aprobada: https://claude.ai/artifact/8zR7xTtTTrtsCwY6iDTK9Z).
-- La Edge Function plan-ai arma el plan en tres pasos (platos → recetas → guardar). La base sigue disponiendo:
-- cada receta pasa por create_assistant_recipe (alergias, dietas, tiempo, cantidades) y cada comida por el
-- trigger de planned_meals; save_generated_plan es el mismo de siempre.

-- Marca de los planes hechos con IA (la app lo dice; sirve también para medir el uso).
alter table public.meal_plans add column created_with_ai boolean not null default false;
comment on column public.meal_plans.created_with_ai is 'ADR-039: plan armado por plan-ai (platos de la IA validados por la base).';

-- Cuota propia de planes con IA (3 al día), aparte del chat: las recetas de un plan cuentan como plan_recipes.
alter type public.ai_kind add value if not exists 'plan_recipes';

-- Motivo de una comida del plan con IA ("Idea de la IA para ti").
insert into public.recommendation_reasons (code, description) values ('ai_pick', 'Plato pensado por la IA para ti')
on conflict (code) do nothing;

-- Copia de 20261114000900_assistant_v2.sql + lo marcado con ADR-039 (varios momentos del día por receta).
create or replace function public.create_assistant_recipe(p_recipe jsonb)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user       uuid := (select auth.uid());
  v_id         uuid;
  v_title      text := btrim(coalesce(p_recipe ->> 'title', ''));
  v_desc       text := nullif(btrim(coalesce(p_recipe ->> 'description', '')), '');
  v_slot       public.meal_slot;
  v_servings   integer;
  v_prep       integer;
  v_cook       integer;
  v_max        integer;
  v_raw        jsonb := coalesce(p_recipe -> 'ingredients', '[]'::jsonb);
  v_ings       jsonb := '[]'::jsonb;   -- del catálogo: { ingredient_id, grams }
  v_extras     jsonb := '[]'::jsonb;   -- fuera del catálogo: { name, grams }
  v_steps      jsonb := coalesce(p_recipe -> 'steps', '[]'::jsonb);
  v_gram       smallint := (select id from public.units where code = 'g');
  v_bad        text;
  v_restricted boolean;
  v_item       jsonb;
  v_match      uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if (select count(*) from public.recipes r
      where r.author_id = v_user and r.created_by_assistant and r.created_at > now() - interval '24 hours') >= 60 then
    raise exception 'quota_exceeded: demasiadas recetas del asistente hoy' using errcode = 'P0001';
  end if;

  begin
    v_slot     := coalesce(p_recipe ->> 'slot', p_recipe -> 'slots' ->> 0)::public.meal_slot;
    perform x::public.meal_slot from jsonb_array_elements_text(coalesce(p_recipe -> 'slots', '[]'::jsonb)) x;
    v_servings := (p_recipe ->> 'servings')::integer;
    v_prep     := (p_recipe ->> 'prep_minutes')::integer;
    v_cook     := (p_recipe ->> 'cook_minutes')::integer;
  exception when others then
    raise exception 'invalid_recipe: momento, porciones o minutos no válidos' using errcode = '22023';
  end;

  if char_length(v_title) not between 3 and 120 then
    raise exception 'invalid_recipe: título' using errcode = '22023';
  end if;
  if v_desc is not null and char_length(v_desc) > 300 then
    raise exception 'invalid_recipe: descripción' using errcode = '22023';
  end if;
  if v_slot is null or v_servings is null or v_servings not between 1 and 12
     or v_prep is null or v_prep not between 0 and 180 or v_cook is null or v_cook not between 0 and 240
     or v_prep + v_cook < 1 then
    raise exception 'invalid_recipe: momento, porciones o minutos fuera de rango' using errcode = '22023';
  end if;
  select p.max_cook_minutes into v_max from public.profiles p where p.id = v_user;
  if v_max is not null and v_prep + v_cook > v_max then
    raise exception 'too_long: la receta pasa tu tiempo máximo' using errcode = 'P0001';
  end if;

  if jsonb_typeof(v_raw) <> 'array' or jsonb_array_length(v_raw) not between 1 and 15 then
    raise exception 'invalid_recipe: entre 1 y 15 ingredientes' using errcode = '22023';
  end if;
  if jsonb_typeof(v_steps) <> 'array' or jsonb_array_length(v_steps) not between 1 and 12 then
    raise exception 'invalid_recipe: entre 1 y 12 pasos' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v_steps) s
             where jsonb_typeof(s) <> 'string' or char_length(btrim(s #>> '{}')) not between 3 and 400) then
    raise exception 'invalid_recipe: cada paso entre 3 y 400 caracteres' using errcode = '22023';
  end if;

  -- ADR-037: separar lo del catálogo de lo libre (un nombre que existe en el catálogo cuenta como catálogo).
  v_restricted := exists (select 1 from public.user_allergens ua where ua.user_id = v_user)
               or exists (select 1 from public.user_diets ud where ud.user_id = v_user);
  for v_item in select * from jsonb_array_elements(v_raw) loop
    begin
      if (v_item ->> 'grams') is null or (v_item ->> 'grams')::numeric not between 1 and 3000 then
        raise exception 'invalid_recipe: cantidad de un ingrediente fuera de rango' using errcode = '22023';
      end if;
    exception when invalid_text_representation then
      raise exception 'invalid_recipe: ingrediente mal formado' using errcode = '22023';
    end;
    if v_item ? 'ingredient_id' then
      begin
        v_match := (v_item ->> 'ingredient_id')::uuid;
      exception when others then
        raise exception 'invalid_recipe: ingrediente mal formado' using errcode = '22023';
      end;
    else
      if char_length(btrim(coalesce(v_item ->> 'name', ''))) not between 2 and 60 then
        raise exception 'invalid_recipe: ingrediente mal formado' using errcode = '22023';
      end if;
      v_match := private.match_ingredient(v_item ->> 'name');
      if v_match is not null and not exists (
           select 1 from public.ingredients i where i.id = v_match and i.allergens_reviewed_at is not null
             and exists (select 1 from public.ingredient_nutrition n where n.ingredient_id = i.id)) then
        v_match := null;
      end if;
    end if;
    if v_match is not null then
      v_ings := v_ings || jsonb_build_array(jsonb_build_object('ingredient_id', v_match, 'grams', (v_item ->> 'grams')::numeric));
    elsif v_restricted then
      -- Con alergias o dietas solo del catálogo: lo libre no se puede revisar.
      raise exception 'unknown_ingredient: solo se usan ingredientes del catálogo' using errcode = 'P0001';
    else
      v_extras := v_extras || jsonb_build_array(jsonb_build_object('name', btrim(v_item ->> 'name'), 'grams', (v_item ->> 'grams')::numeric));
    end if;
  end loop;

  if jsonb_array_length(v_ings) = 0 then
    raise exception 'invalid_recipe: al menos un ingrediente del catálogo' using errcode = '22023';
  end if;
  if (select count(distinct x ->> 'ingredient_id') from jsonb_array_elements(v_ings) x) <> jsonb_array_length(v_ings) then
    raise exception 'invalid_recipe: ingrediente repetido' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v_ings) x
             left join public.ingredients i on i.id = (x ->> 'ingredient_id')::uuid
             where i.id is null or i.allergens_reviewed_at is null
                or not exists (select 1 from public.ingredient_nutrition n where n.ingredient_id = i.id)) then
    raise exception 'unknown_ingredient: solo se usan ingredientes del catálogo' using errcode = 'P0001';
  end if;
  -- ALERGIAS y DIETAS (duro): ni un solo ingrediente bloqueado para la persona.
  select i.name into v_bad
  from jsonb_array_elements(v_ings) x join public.ingredients i on i.id = (x ->> 'ingredient_id')::uuid
  where private.ingredient_blocked_for_user(i.id, v_user)
  limit 1;
  if v_bad is not null then
    raise exception 'blocked_ingredient: % no es seguro para ti', v_bad using errcode = 'P0001';
  end if;

  insert into public.recipes (author_id, title, description, base_servings, prep_minutes, cook_minutes, difficulty,
                              status, created_by_assistant)
  values (v_user, v_title, v_desc, v_servings, v_prep, v_cook, 1, 'draft', true)
  returning id into v_id;
  -- ADR-039: una receta del plan con IA sirve para almuerzo y cena ("slots"); si no, su único momento.
  insert into public.recipe_meal_slots (recipe_id, slot)
  select distinct v_id, x::public.meal_slot
  from jsonb_array_elements_text(case when jsonb_typeof(p_recipe -> 'slots') = 'array' and jsonb_array_length(p_recipe -> 'slots') > 0
                                      then p_recipe -> 'slots' else jsonb_build_array(v_slot::text) end) x;
  insert into public.recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id, sort_order)
  select v_id, (x ->> 'ingredient_id')::uuid, round((x ->> 'grams')::numeric, 1), v_gram, (o - 1)::smallint
  from jsonb_array_elements(v_ings) with ordinality as t(x, o);
  insert into public.recipe_extra_ingredients (recipe_id, position, name, grams)
  select v_id, o::smallint, x ->> 'name', round((x ->> 'grams')::numeric, 1)
  from jsonb_array_elements(v_extras) with ordinality as t(x, o);
  insert into public.recipe_steps (recipe_id, step_number, instruction)
  select v_id, o::smallint, btrim(s #>> '{}') from jsonb_array_elements(v_steps) with ordinality as t(s, o);
  return v_id;
end $$;
