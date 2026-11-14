-- ADR-037 · Asistente v2, entrega 1: "IA primero".
--   * La IA propone una LISTA de 4–5 platos (nombre, frase, minutos); la persona elige uno y la IA llena la
--     plantilla de la receta. Las ideas del mensaje se guardan (assistant_messages.ideas) para ese segundo paso.
--   * La IA conoce las preferencias de la persona (assistant_profile): para cuántos cocina, tiempo, picante,
--     presupuesto, cocinas favoritas y una lista de "no usar". Las alergias y dietas entran a esa lista SIN el
--     porqué, mezcladas con lo que no le gusta (ADR-025, Ley 1581: qué evitar sí, por qué no).
--   * Libertad de ingredientes (opción A): sin alergias ni dietas, la receta puede llevar ingredientes fuera
--     del catálogo (recipe_extra_ingredients). Con ellas, solo del catálogo: así la base revisa cada uno.
--   * La base sigue disponiendo: create_assistant_recipe vuelve a validar alergias, dietas, tiempo y cantidades.

-- ---- Ideas de un mensaje (para "llenar la receta" de la que se elija) ----------------------------------
alter table public.assistant_messages add column ideas jsonb;
comment on column public.assistant_messages.ideas is
  'ADR-037: { target, slot, items: [{ title, blurb, minutes, recipe_id }] }. recipe_id solo si la idea es del recetario (respaldo). La escribe la Edge Function.';

-- Hasta 5 recetas por mensaje (una por idea elegida).
alter table public.assistant_message_suggestions drop constraint assistant_message_suggestions_position_check;
alter table public.assistant_message_suggestions add constraint assistant_message_suggestions_position_check check (position between 1 and 5);

-- ---- Ingredientes fuera del catálogo (solo quien no tiene alergias ni dietas) ----------------------------
create table public.recipe_extra_ingredients (
  recipe_id uuid     not null references public.recipes (id) on delete cascade,
  position  smallint not null check (position between 1 and 15),
  name      text     not null check (char_length(btrim(name)) between 2 and 60),
  grams     numeric(8, 1) not null check (grams between 1 and 3000),
  primary key (recipe_id, position)
);
comment on table public.recipe_extra_ingredients is
  'ADR-037: ingredientes que la IA usó y no están en el catálogo (p. ej. "chontaduro"). Sin datos de nutrición ni precio. Solo en recetas del asistente de personas SIN alergias ni dietas.';
alter table public.recipe_extra_ingredients enable row level security;
-- Se ven si la receta se ve (la RLS de recipes decide: una receta del asistente es borrador privado de su autora).
create policy recipe_extra_ingredients_read on public.recipe_extra_ingredients for select to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id));
grant select on public.recipe_extra_ingredients to authenticated;

-- ---- Lo que la IA sabe de la persona -------------------------------------------------------------------
-- Nada de nombres de alergias, dietas, condiciones ni metas de salud: solo qué evitar (mezclado y ordenado,
-- sin saber de dónde viene cada cosa) y si hay restricciones (para limitar al catálogo).
create function public.assistant_profile()
returns jsonb
language sql stable set search_path = '' as $$
  with me as (select (select auth.uid()) as uid),
  avoid as (
    -- alergias (el alérgeno, como ingrediente a evitar)
    select a.name from public.user_allergens ua join public.allergens a on a.id = ua.allergen_id, me where ua.user_id = me.uid
    union
    -- dietas por ingredientes: grupos y alérgenos que excluyen
    select fg.name from public.user_diets ud
      join public.diets d on d.id = ud.diet_id and d.kind = 'rule_based'
      join public.diet_excluded_food_groups x on x.diet_id = d.id
      join public.food_groups fg on fg.id = x.food_group_id, me
    where ud.user_id = me.uid
    union
    select a.name from public.user_diets ud
      join public.diets d on d.id = ud.diet_id and d.kind = 'rule_based'
      join public.diet_excluded_allergens xa on xa.diet_id = d.id
      join public.allergens a on a.id = xa.allergen_id, me
    where ud.user_id = me.uid
    union
    -- lo que no le gusta
    select i.name from public.user_disliked_ingredients udi join public.ingredients i on i.id = udi.ingredient_id, me
    where udi.user_id = me.uid
  )
  select jsonb_build_object(
    'servings', p.household_size,
    'max_minutes', p.max_cook_minutes,
    'spice', p.spice_tolerance,
    -- Presupuesto por persona y semana: menos de $70.000 es "ajustado" (referencia del piloto en Pasto).
    'budget', case
                when p.budget_amount is null then null
                when (case p.budget_period when 'month' then p.budget_amount * 7 / 30.0 else p.budget_amount end)
                     / greatest(p.household_size, 1) < 70000 then 'tight'
                else 'normal' end,
    'cuisines', coalesce((select jsonb_agg(c.name order by c.name)
                          from public.user_cuisines uc join public.cuisines c on c.id = uc.cuisine_id
                          where uc.user_id = p.id), '[]'::jsonb),
    'avoid', coalesce((select jsonb_agg(distinct v.name order by v.name) from avoid v), '[]'::jsonb),
    'restricted', exists (select 1 from public.user_allergens ua where ua.user_id = p.id)
                  or exists (select 1 from public.user_diets ud where ud.user_id = p.id)
  )
  from public.profiles p, me
  where p.id = me.uid
$$;
comment on function public.assistant_profile() is
  'ADR-037: lo que el asistente sabe de quien consulta. Preferencias tal cual; alergias y dietas solo como cosas a evitar (sin el porqué).';
revoke all on function public.assistant_profile() from public, anon;
grant execute on function public.assistant_profile() to authenticated;

-- ---- Recetas del asistente con ingredientes libres --------------------------------------------------------
-- Copia de 20261114000100_assistant_recipes.sql + lo marcado con ADR-037: un ingrediente puede venir como
-- { name, grams }. Si el nombre está en el catálogo ("Limones" → Limón) se usa ese ingrediente; si no, va a
-- recipe_extra_ingredients, y solo si la persona no tiene alergias ni dietas. Al menos uno del catálogo.
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
    v_slot     := (p_recipe ->> 'slot')::public.meal_slot;
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
  insert into public.recipe_meal_slots (recipe_id, slot) values (v_id, v_slot);
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
