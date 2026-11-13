-- ADR-033 · Mi cocina, fase 1: que el ciclo lista → compra → despensa no se rompa (revisión de Mi cocina, C1).
--   * Lo que se agrega a la lista desde una receta o una sugerencia entra como INGREDIENTE con sus gramos
--     (add_ingredients_to_list), no como texto: al comprarlo pasa a la despensa.
--   * Lo que se escribe a mano se reconoce AL PASARLO A LA DESPENSA: si existe en el catálogo ("aguacates",
--     "limon") entra como ese ingrediente; si no, como alimento propio (B3b), salvo que la clasificación
--     (food_labels) diga que no es comida ("bolsas"). Antes se cerraba y desaparecía.
--   * Si el plan necesita un ingrediente que ya se agregó a mano (sin comprar), la fila pasa a ser del plan.
-- La lista "al día" (C2) se resuelve en la app regenerando tras cada cambio de la cocina o del plan
-- (generate_shopping_list ya es idempotente y respeta lo marcado y lo manual).

-- ---- Normalizar y reconocer nombres ------------------------------------------------------------------
-- Igual que normalizeFoodText de categorize-food: sin tildes, minúsculas, solo letras y números.
create function private.food_key(p_text text)
returns text language sql immutable set search_path = '' as $$
  select left(btrim(regexp_replace(lower(private.f_unaccent(coalesce(p_text, ''))), '[^a-z0-9]+', ' ', 'g')), 80)
$$;

-- Plural español a singular, palabra por palabra: "limones" → "limon", "papas criollas" → "papa criolla".
create function private.food_singular(p_key text)
returns text language sql immutable set search_path = '' as $$
  select string_agg(case
           when char_length(w) <= 3 then w
           when w ~ '[lnrdzj]es$' then left(w, -2)
           when w ~ 's$' then left(w, -1)
           else w end, ' ' order by n)
  from unnest(string_to_array(p_key, ' ')) with ordinality as t(w, n)
$$;

-- El ingrediente del catálogo que corresponde a un nombre escrito a mano (exacto, con o sin plural).
create function private.match_ingredient(p_text text)
returns uuid language sql stable set search_path = '' as $$
  select i.id from public.ingredients i
  where private.food_singular(private.food_key(i.name)) = private.food_singular(private.food_key(p_text))
  order by char_length(i.name)
  limit 1
$$;

-- Cuánto se compra "una vez" de un ingrediente cuando no se dijo cuánto: una unidad si se vende por unidad,
-- si no, una libra (500 g).
create function private.default_purchase_g(p_ingredient_id uuid)
returns numeric language sql stable set search_path = '' as $$
  select coalesce((select w.grams from public.ingredient_unit_weights w join public.units u on u.id = w.unit_id
                   where w.ingredient_id = p_ingredient_id and u.code = 'unit'), 500)
$$;

-- ---- Agregar ingredientes con su cantidad (receta, "Para completar más recetas", asistente) -----------
-- p_items: [{ ingredient_id, grams }]. Si ya está (sin comprar) se suma; si ya se había comprado, vuelve a la
-- lista con lo nuevo; si el plan ya lo pide, no se duplica (la lista del plan se recalcula sola).
create function public.add_ingredients_to_list(p_list_id uuid, p_items jsonb)
returns integer
language plpgsql set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_n    integer := 0;
  r      record;
  v_row  public.shopping_list_items;
begin
  if not exists (select 1 from public.shopping_lists where id = p_list_id and user_id = v_user) then
    raise exception 'list_not_found' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'invalid_quantity: entre 1 y 50 ingredientes' using errcode = '22023';
  end if;

  for r in
    select (x ->> 'ingredient_id')::uuid as ingredient_id, round((x ->> 'grams')::numeric, 2) as grams
    from jsonb_array_elements(p_items) x
  loop
    if r.grams is null or r.grams <= 0 or r.grams > 100000 then
      raise exception 'invalid_quantity: cantidad fuera de rango' using errcode = '22023';
    end if;
    if not exists (select 1 from public.ingredients where id = r.ingredient_id) then
      raise exception 'invalid_quantity: ingrediente desconocido' using errcode = '22023';
    end if;

    select * into v_row from public.shopping_list_items where list_id = p_list_id and ingredient_id = r.ingredient_id for update;
    if not found then
      insert into public.shopping_list_items (list_id, ingredient_id, needed_g, source)
      values (p_list_id, r.ingredient_id, r.grams, 'manual');
      v_n := v_n + 1;
    elsif v_row.source = 'manual' and v_row.moved_to_pantry_at is null and not v_row.is_checked then
      update public.shopping_list_items set needed_g = coalesce(needed_g, 0) + r.grams where id = v_row.id;
      v_n := v_n + 1;
    elsif v_row.source = 'manual' then
      -- ya comprado: vuelve a la lista con lo nuevo
      update public.shopping_list_items
         set needed_g = r.grams, pantry_g = 0, is_checked = false, checked_at = null, moved_to_pantry_at = null
       where id = v_row.id;
      v_n := v_n + 1;
    end if;
    -- source = 'plan': el plan ya lo pide; generate_shopping_list mantiene la cantidad al día.
  end loop;
  return v_n;
end $$;
revoke all on function public.add_ingredients_to_list(uuid, jsonb) from public, anon;
grant execute on function public.add_ingredients_to_list(uuid, jsonb) to authenticated, service_role;

-- ---- Pasar lo comprado a la despensa: ya no se pierde lo escrito a mano --------------------------------
-- Copia de 20261113000100_shopping_close_bought.sql + lo manual sin ingrediente pasa como alimento propio.
create or replace function public.move_checked_to_pantry(p_list_id uuid)
returns integer
language plpgsql set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_g    smallint := (select id from public.units where code = 'g');
  v_n    integer := 0;
  r      record;
begin
  if not exists (select 1 from public.shopping_lists where id = p_list_id and user_id = v_user) then
    raise exception 'list_not_found' using errcode = 'P0002';
  end if;
  for r in
    select sli.id, sli.ingredient_id, sli.to_buy_g, i.shelf_life_days
    from public.shopping_list_items sli join public.ingredients i on i.id = sli.ingredient_id
    where sli.list_id = p_list_id and sli.is_checked and sli.moved_to_pantry_at is null and coalesce(sli.to_buy_g, 0) > 0
    for update of sli
  loop
    perform public.add_to_pantry(r.ingredient_id, r.to_buy_g, v_g,
                                 case when r.shelf_life_days is not null then current_date + r.shelf_life_days end);
    update public.shopping_list_items set moved_to_pantry_at = now() where id = r.id;
    v_n := v_n + 1;
  end loop;

  -- Lo escrito a mano: si es un ingrediente del catálogo, entra como ese ingrediente (lo que se compra una vez);
  -- si no, como alimento propio (1 unidad) con el grupo y la sección que dejó la clasificación. Lo que la
  -- clasificación dice que no es comida ("bolsas") solo se cierra.
  for r in
    select sli.id, sli.custom_name, sli.store_category_id, fl.food_group_id, fl.is_food,
           private.match_ingredient(sli.custom_name) as ingredient_id
    from public.shopping_list_items sli
    left join public.food_labels fl on fl.key = private.food_key(sli.custom_name)
    where sli.list_id = p_list_id and sli.is_checked and sli.moved_to_pantry_at is null and sli.ingredient_id is null
    for update of sli
  loop
    if r.ingredient_id is not null then
      perform public.add_to_pantry(r.ingredient_id, private.default_purchase_g(r.ingredient_id), v_g,
                                   (select case when i.shelf_life_days is not null then current_date + i.shelf_life_days end
                                    from public.ingredients i where i.id = r.ingredient_id));
      v_n := v_n + 1;
    elsif coalesce(r.is_food, true) then
      insert into public.pantry_custom_items (user_id, name, quantity, unit, food_group_id, store_category_id)
      values (v_user, r.custom_name, 1, 'unit', r.food_group_id, r.store_category_id);
      v_n := v_n + 1;
    end if;
    update public.shopping_list_items set moved_to_pantry_at = now() where id = r.id;
  end loop;

  return v_n;
end $$;
comment on function public.move_checked_to_pantry(uuid) is
  'Pasa a la despensa lo marcado como comprado: ingredientes (con vencimiento según la vida útil), lo escrito a mano que existe en el catálogo como ese ingrediente y el resto como alimento propio, salvo lo que no es comida. Devuelve cuántos ítems entraron a la despensa.';

-- ---- Si el plan necesita algo agregado a mano (sin comprar), la fila pasa a ser del plan ---------------
-- Copia de 20261015000200_substitutes.sql + el ON CONFLICT marcado. Sin esto, una fila manual del mismo
-- ingrediente bloqueaba la cantidad del plan (una fila por ingrediente en cada lista).
create or replace function public.generate_shopping_list(p_plan_id uuid)
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
    select coalesce(sub.substitute_id, l.ingredient_id) as ingredient_id,
           round(sum(l.grams * coalesce(sub.ratio, 1)), 2) as grams
    from public.planned_meals pm
    cross join lateral private.recipe_lines(pm.recipe_id, pm.servings, v_user, pm.id) l
    join public.ingredients i on i.id = l.ingredient_id
    -- Salvaguarda: una sustitución con algo que la persona no puede comer se ignora (aunque se haya insertado a mano).
    left join public.shopping_list_substitutions sub
           on sub.list_id = v_list and sub.ingredient_id = l.ingredient_id
          and not private.ingredient_blocked_for_user(sub.substitute_id, v_user)
    where pm.plan_id = p_plan_id and pm.status = 'planned' and not l.is_optional and not i.is_staple
    group by 1
  ),
  stock as (
    select pi.ingredient_id, sum(pi.quantity_g) as grams
    from public.pantry_items pi
    where pi.user_id = v_user and pi.quantity_g > 0 and (pi.expires_on is null or pi.expires_on >= current_date)
    group by pi.ingredient_id
  ),
  purge as (
    delete from public.shopping_list_items sli
    where sli.list_id = v_list and sli.source = 'plan' and not sli.is_checked
      and sli.ingredient_id not in (select ingredient_id from needs)
  )
  insert into public.shopping_list_items (list_id, ingredient_id, needed_g, pantry_g, source)
  select v_list, n.ingredient_id, n.grams, coalesce(st.grams, 0), 'plan'
  from needs n left join stock st on st.ingredient_id = n.ingredient_id
  where n.grams > 0
  on conflict (list_id, ingredient_id) do update
    set needed_g = excluded.needed_g, pantry_g = excluded.pantry_g, source = 'plan'
    where public.shopping_list_items.source = 'plan'
       -- ADR-033: lo agregado a mano (sin comprar) del mismo ingrediente pasa a ser del plan
       or (not public.shopping_list_items.is_checked and public.shopping_list_items.moved_to_pantry_at is null);

  return v_list;
end $$;

-- ---- "Para completar más recetas" también dice cuánto comprar ------------------------------------------
-- Copia de 20261114000200_pantry_parse_buy_next.sql + grams (lo que más falta entre las recetas que ayuda).
drop function public.what_to_buy_next(integer);
create function public.what_to_buy_next(p_limit integer default 3)
returns table (ingredient_id uuid, name text, completes integer, helps integer, recipes text[], grams numeric)
language sql stable set search_path = '' as $$
  with near as (
    select c.recipe_id, c.title, c.missing_count, c.missing
    from public.cook_with_what_i_have(null, null, 50) c
    where c.missing_count between 1 and 2
  ),
  missing as (
    select n.recipe_id, n.title, n.missing_count, (x ->> 'ingredient_id')::uuid as ingredient_id, x ->> 'ingredient_name' as name,
           (x ->> 'missing_g')::numeric as missing_g
    from near n cross join lateral jsonb_array_elements(n.missing) x
  )
  select m.ingredient_id, m.name,
         count(*) filter (where m.missing_count = 1)::int as completes,
         count(*)::int as helps,
         (array_agg(m.title order by m.missing_count, m.title))[1:3] as recipes,
         max(m.missing_g) as grams
  from missing m
  group by m.ingredient_id, m.name
  order by 3 desc, 4 desc, m.name
  limit least(greatest(coalesce(p_limit, 3), 1), 10)
$$;
revoke all on function public.what_to_buy_next(integer) from public, anon;
grant execute on function public.what_to_buy_next(integer) to authenticated;
