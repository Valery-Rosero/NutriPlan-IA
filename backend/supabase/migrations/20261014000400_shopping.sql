-- =============================================================================
-- 0017 · Sprint 5: lista de compras por sección y "lo comprado pasa a la despensa"
-- =============================================================================

alter table public.shopping_list_items add column moved_to_pantry_at timestamptz;
comment on column public.shopping_list_items.moved_to_pantry_at is
  'Cuándo se sumó a la despensa lo comprado (evita sumarlo dos veces).';

-- Los básicos (sal, aceite, agua, especias) se dan por disponibles: no se llenan las listas con ellos.
-- Quien se quede sin aceite lo agrega a mano.
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
    select l.ingredient_id, round(sum(l.grams), 2) as grams
    from public.planned_meals pm
    cross join lateral private.recipe_lines(pm.recipe_id, pm.servings, v_user, pm.id) l
    join public.ingredients i on i.id = l.ingredient_id
    where pm.plan_id = p_plan_id and pm.status = 'planned' and not l.is_optional and not i.is_staple
    group by l.ingredient_id
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
    set needed_g = excluded.needed_g, pantry_g = excluded.pantry_g
    where public.shopping_list_items.source = 'plan';

  return v_list;
end $$;

-- Lista lista para mostrar (US-135): nombre, sección del supermercado en el orden de la persona y,
-- para lo que se compra por unidades, cuántas unidades aproximadas (calculado aquí, no en la app).
create view public.my_shopping_items with (security_invoker = true) as
select sli.id, sli.list_id, sli.ingredient_id,
       coalesce(i.name, sli.custom_name) as name,
       c.id as category_id, c.name as category_name,
       coalesce(uso.position, c.sort_order, 99)::int as category_position,
       sli.needed_g, sli.pantry_g, sli.to_buy_g, sli.is_checked, sli.source, sli.moved_to_pantry_at,
       case when uw.grams is not null and sli.to_buy_g > 0 then ceil(sli.to_buy_g / uw.grams)::int end as approx_units
from public.shopping_list_items sli
left join public.ingredients i on i.id = sli.ingredient_id
left join public.ingredient_categories c on c.id = coalesce(i.store_category_id, sli.store_category_id)
left join public.user_section_order uso on uso.store_category_id = c.id and uso.user_id = (select auth.uid())
left join public.ingredient_unit_weights uw
       on uw.ingredient_id = sli.ingredient_id and uw.unit_id = (select u.id from public.units u where u.code = 'unit');

-- Lo marcado como comprado pasa a la despensa, con vencimiento según la vida útil del ingrediente.
create function public.move_checked_to_pantry(p_list_id uuid)
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
  return v_n;
end $$;

grant select on public.my_shopping_items to authenticated;
revoke execute on function public.move_checked_to_pantry(uuid) from public, anon;
grant execute on function public.move_checked_to_pantry(uuid) to authenticated, service_role;
