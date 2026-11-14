-- ADR-035 · Mi cocina, fase 3: una lista que se puede usar en el súper (revisión de Mi cocina, A1 · A2 · M5).
--   * A1 · Lista de la casa: siempre existe, haya plan o no (my_house_list). Lo anotado sin plan pasa a la lista
--     de la semana cuando se arma (generate_shopping_list).
--   * A2 · Cantidades como se venden: private.purchase traduce "38 g de ahuyama" a "1 pedazo pequeño", "media
--     libra", "3 unidades" o "medio litro". Lo que pasa a la despensa es lo que se compró (lo redondeado).
--   * M5 · Quitar de la lista se puede deshacer: la fila se oculta (dismissed_at), no se borra. Así además el
--     plan no la vuelve a poner cada vez que la lista se rehace (ADR-033).

-- ---- A1 · Lista de la casa -----------------------------------------------------------------------------
alter table public.shopping_lists add column is_house boolean not null default false;
create unique index shopping_lists_house_uq on public.shopping_lists (user_id) where is_house;
comment on column public.shopping_lists.is_house is
  'ADR-035: la lista de la casa (una por persona, sin plan). Lo pendiente pasa a la lista del plan al armarla.';

create function public.my_house_list()
returns uuid
language plpgsql set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_id   uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  insert into public.shopping_lists (user_id, is_house, name) values (v_user, true, 'Lista de la casa')
  on conflict (user_id) where is_house do update set updated_at = now()
  returning id into v_id;
  return v_id;
end $$;
comment on function public.my_house_list() is 'ADR-035: la lista de la casa de quien consulta (la crea si no existe).';

-- ---- M5 · Quitar con deshacer ---------------------------------------------------------------------------
alter table public.shopping_list_items add column dismissed_at timestamptz;
comment on column public.shopping_list_items.dismissed_at is
  'ADR-035: quitada de la lista (se puede deshacer). El plan no la vuelve a poner al rehacer la lista.';

-- ---- A2 · Cómo se compra -------------------------------------------------------------------------------
-- kind: unit (N unidades) · pinch (un poco: hierbas y especias) · piece (un pedazo pequeño) · ml (litros)
--       · weight (libras o kilos). grams: lo que de verdad se compra (pasa a la despensa).
create function private.purchase(p_ingredient_id uuid, p_grams numeric)
returns table (kind text, grams numeric, units integer)
language plpgsql stable set search_path = '' as $$
declare
  v_group  text;
  v_unit_g numeric;
  v_liquid boolean;
begin
  if p_ingredient_id is null or p_grams is null or p_grams <= 0 then
    return query select 'none'::text, 0::numeric, null::integer;
    return;
  end if;
  select fg.code into v_group from public.ingredients i join public.food_groups fg on fg.id = i.food_group_id
  where i.id = p_ingredient_id;
  select w.grams into v_unit_g from public.ingredient_unit_weights w join public.units u on u.id = w.unit_id
  where w.ingredient_id = p_ingredient_id and u.code = 'unit';
  -- Líquido = en las recetas siempre se mide por volumen (leche, caldo).
  select bool_and(u.dimension = 'volume') into v_liquid
  from public.recipe_ingredients ri join public.units u on u.id = ri.unit_id
  where ri.ingredient_id = p_ingredient_id;

  if v_group = 'herbs_spices' then
    return query select 'pinch'::text, p_grams, null::integer;
  -- Por unidad, salvo que la unidad sea grande y se necesite poco (una ahuyama entera por 38 g, no).
  elsif v_unit_g is not null and (v_unit_g <= 600 or p_grams >= v_unit_g / 2) then
    return query select 'unit'::text, ceil(p_grams / v_unit_g) * v_unit_g, ceil(p_grams / v_unit_g)::integer;
  elsif coalesce(v_liquid, false) then
    return query select 'ml'::text, ceil(p_grams / 250) * 250, null::integer;
  elsif p_grams < 150 and v_group in ('vegetables', 'fruits', 'tubers') then
    return query select 'piece'::text, 250::numeric, null::integer;
  elsif p_grams <= 3000 then
    return query select 'weight'::text, ceil(p_grams / 250) * 250, null::integer;   -- de a media libra
  else
    return query select 'weight'::text, ceil(p_grams / 500) * 500, null::integer;
  end if;
end $$;
comment on function private.purchase(uuid, numeric) is
  'ADR-035: cómo se compra una cantidad (unidades, un poco, un pedazo pequeño, litros o libras) y cuántos gramos son.';

-- La vista de la lista: sin lo quitado y con cómo se compra (columnas nuevas al final).
create or replace view public.my_shopping_items with (security_invoker = true) as
select sli.id, sli.list_id, sli.ingredient_id,
       coalesce(i.name, sli.custom_name) as name,
       c.id as category_id, c.name as category_name,
       coalesce(uso.position, c.sort_order, 99)::int as category_position,
       sli.needed_g, sli.pantry_g, sli.to_buy_g, sli.is_checked, sli.source, sli.moved_to_pantry_at,
       case when uw.grams is not null and sli.to_buy_g > 0 then ceil(sli.to_buy_g / uw.grams)::int end as approx_units,
       (select string_agg(oi.name, ', ' order by oi.name)
          from public.shopping_list_substitutions sub join public.ingredients oi on oi.id = sub.ingredient_id
         where sub.list_id = sli.list_id and sub.substitute_id = sli.ingredient_id) as replaces_name,
       p.kind as buy_kind, p.grams as buy_g, p.units as buy_units
from public.shopping_list_items sli
left join public.ingredients i on i.id = sli.ingredient_id
left join public.ingredient_categories c on c.id = coalesce(i.store_category_id, sli.store_category_id)
left join public.user_section_order uso on uso.store_category_id = c.id and uso.user_id = (select auth.uid())
left join public.ingredient_unit_weights uw
       on uw.ingredient_id = sli.ingredient_id and uw.unit_id = (select u.id from public.units u where u.code = 'unit')
left join lateral private.purchase(sli.ingredient_id, sli.to_buy_g) p on true
where sli.dismissed_at is null;

-- ---- Agregar: lo quitado vuelve si se pide otra vez ------------------------------------------------------
create or replace function public.add_ingredients_to_list(p_list_id uuid, p_items jsonb)
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
    elsif v_row.dismissed_at is not null then
      -- Se había quitado: vuelve (si era del plan, con lo del plan; si no, con lo nuevo).
      update public.shopping_list_items
         set dismissed_at = null,
             needed_g = case when v_row.source = 'manual' then r.grams else needed_g end,
             is_checked = false, checked_at = null, moved_to_pantry_at = null
       where id = v_row.id;
      v_n := v_n + 1;
    elsif v_row.source = 'manual' and v_row.moved_to_pantry_at is null and not v_row.is_checked then
      update public.shopping_list_items set needed_g = coalesce(needed_g, 0) + r.grams where id = v_row.id;
      v_n := v_n + 1;
    elsif v_row.source = 'manual' then
      update public.shopping_list_items
         set needed_g = r.grams, pantry_g = 0, is_checked = false, checked_at = null, moved_to_pantry_at = null
       where id = v_row.id;
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;

-- ---- Pasar a la despensa lo que se compró (redondeado) y no lo quitado -----------------------------------
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
    select sli.id, sli.ingredient_id, p.grams as bought_g, i.shelf_life_days
    from public.shopping_list_items sli
    join public.ingredients i on i.id = sli.ingredient_id
    cross join lateral private.purchase(sli.ingredient_id, sli.to_buy_g) p
    where sli.list_id = p_list_id and sli.is_checked and sli.moved_to_pantry_at is null and sli.dismissed_at is null
      and coalesce(sli.to_buy_g, 0) > 0
    for update of sli
  loop
    perform public.add_to_pantry(r.ingredient_id, r.bought_g, v_g,
                                 case when r.shelf_life_days is not null then current_date + r.shelf_life_days end);
    update public.shopping_list_items set moved_to_pantry_at = now() where id = r.id;
    v_n := v_n + 1;
  end loop;

  for r in
    select sli.id, sli.custom_name, sli.store_category_id, fl.food_group_id, fl.is_food,
           private.match_ingredient(sli.custom_name) as ingredient_id
    from public.shopping_list_items sli
    left join public.food_labels fl on fl.key = private.food_key(sli.custom_name)
    where sli.list_id = p_list_id and sli.is_checked and sli.moved_to_pantry_at is null and sli.dismissed_at is null
      and sli.ingredient_id is null
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
  'Pasa a la despensa lo marcado como comprado, en la cantidad que se compra (ADR-035): ingredientes con vencimiento según la vida útil, lo escrito a mano que existe en el catálogo como ese ingrediente y el resto como alimento propio, salvo lo que no es comida. Lo quitado de la lista no cuenta.';

-- ---- Armar la lista del plan: trae lo anotado en la lista de la casa -------------------------------------
create or replace function public.generate_shopping_list(p_plan_id uuid)
returns uuid
language plpgsql set search_path = '' as $$
declare
  v_user  uuid := (select auth.uid());
  v_list  uuid;
  v_house uuid;
begin
  if not exists (select 1 from public.meal_plans where id = p_plan_id and user_id = v_user) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;

  insert into public.shopping_lists (user_id, plan_id) values (v_user, p_plan_id)
  on conflict (plan_id) where plan_id is not null do update set updated_at = now()
  returning id into v_list;

  -- A1: lo pendiente de la lista de la casa pasa a esta lista (si el ingrediente ya está aquí, se suma a lo
  -- manual pendiente; si lo pide el plan, el plan manda).
  select id into v_house from public.shopping_lists where user_id = v_user and is_house;
  if v_house is not null then
    update public.shopping_list_items h set list_id = v_list
    where h.list_id = v_house and not h.is_checked and h.moved_to_pantry_at is null and h.dismissed_at is null
      and (h.ingredient_id is null
           or not exists (select 1 from public.shopping_list_items x where x.list_id = v_list and x.ingredient_id = h.ingredient_id));
    update public.shopping_list_items x set needed_g = coalesce(x.needed_g, 0) + h.needed_g, dismissed_at = null
    from public.shopping_list_items h
    where h.list_id = v_house and not h.is_checked and h.moved_to_pantry_at is null and h.dismissed_at is null
      and x.list_id = v_list and x.ingredient_id = h.ingredient_id
      and x.source = 'manual' and not x.is_checked and x.moved_to_pantry_at is null;
    delete from public.shopping_list_items h
    where h.list_id = v_house and not h.is_checked and h.moved_to_pantry_at is null and h.dismissed_at is null;
  end if;

  with needs as (
    select coalesce(sub.substitute_id, l.ingredient_id) as ingredient_id,
           round(sum(l.grams * coalesce(sub.ratio, 1)), 2) as grams
    from public.planned_meals pm
    cross join lateral private.recipe_lines(pm.recipe_id, pm.servings, v_user, pm.id) l
    join public.ingredients i on i.id = l.ingredient_id
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
       or (not public.shopping_list_items.is_checked and public.shopping_list_items.moved_to_pantry_at is null
           and public.shopping_list_items.dismissed_at is null);
  -- (lo quitado de la lista sigue quitado: dismissed_at no se toca)

  return v_list;
end $$;

revoke all on function public.my_house_list() from public, anon;
grant execute on function public.my_house_list() to authenticated;
