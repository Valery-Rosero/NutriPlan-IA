-- US-147: sustitutos de ingredientes.
-- En NutriPlan las alergias y dietas son restricciones DURAS: una receta con algo que no puedes comer
-- ni siquiera aparece. Donde el sustituto aporta es en lo que NO TIENES: "no tengo pechuga, ¿uso muslo?".
-- 1) suggest_substitutes_for: sustitutos de varios ingredientes a la vez (una sola llamada desde la receta),
--    filtrados por alérgenos y dietas de quien consulta y marcando cuáles ya tiene en la cocina.
-- 2) La lista de mercado recuerda la sustitución (shopping_list_substitutions) para que "Actualizar
--    desde el plan" no la deshaga: generate_shopping_list compra el sustituto en lugar del original.
-- 3) substitute_shopping_item / undo_shopping_substitution: reemplazar y deshacer con un toque.
-- El catálogo de sustitutos vive en catalog/04_substitutions.sql (seed); aquí se repite para la base existente.

-- ---- 1. Sustitutos de varios ingredientes -----------------------------------------------------
create function public.suggest_substitutes_for(p_ingredient_ids uuid[])
returns table (ingredient_id uuid, substitute_id uuid, substitute_name text, ratio numeric, note text, in_pantry boolean)
language sql stable set search_path = '' as $$
  select s.ingredient_id, s.substitute_id, i.name, s.ratio, s.note,
         private.in_pantry((select auth.uid()), s.substitute_id)
  from public.ingredient_substitutions s
  join public.ingredients i on i.id = s.substitute_id
  where s.ingredient_id = any (coalesce(p_ingredient_ids, '{}'))
    and not private.ingredient_blocked_for_user(s.substitute_id, (select auth.uid()))
  order by s.ingredient_id, private.in_pantry((select auth.uid()), s.substitute_id) desc, i.name
$$;

-- ---- 2. Sustituciones recordadas por lista ------------------------------------------------------
create table public.shopping_list_substitutions (
  list_id       uuid not null references public.shopping_lists(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id),
  substitute_id uuid not null references public.ingredients(id),
  ratio         numeric(6,3) not null check (ratio > 0),
  created_at    timestamptz not null default now(),
  primary key (list_id, ingredient_id),
  check (ingredient_id <> substitute_id)
);
comment on table public.shopping_list_substitutions is
  'US-147: en esta lista, el ingrediente del plan se compra como su sustituto (cantidad × ratio).';

alter table public.shopping_list_substitutions enable row level security;
-- Mismo patrón que shopping_list_items: cada quien toca solo las sustituciones de sus listas.
create policy shopping_list_substitutions_own on public.shopping_list_substitutions for all to authenticated
  using (exists (select 1 from public.shopping_lists l where l.id = list_id and l.user_id = (select auth.uid())))
  with check (exists (select 1 from public.shopping_lists l where l.id = list_id and l.user_id = (select auth.uid())));
revoke truncate, references, trigger on public.shopping_list_substitutions from authenticated;
revoke all on public.shopping_list_substitutions from anon;

-- La lista generada aplica las sustituciones guardadas.
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
    set needed_g = excluded.needed_g, pantry_g = excluded.pantry_g
    where public.shopping_list_items.source = 'plan';

  return v_list;
end $$;

-- ---- 3. Reemplazar y deshacer -----------------------------------------------------------------
create function public.substitute_shopping_item(p_item_id uuid, p_substitute_id uuid)
returns void
language plpgsql set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_item record;
  v_ratio numeric;
begin
  select sli.id, sli.list_id, sli.ingredient_id, sli.is_checked, sli.source, l.plan_id into v_item
  from public.shopping_list_items sli join public.shopping_lists l on l.id = sli.list_id
  where sli.id = p_item_id and l.user_id = v_user;
  if not found then
    raise exception 'list_not_found' using errcode = 'P0002';
  end if;
  if v_item.source <> 'plan' or v_item.plan_id is null or v_item.is_checked then
    raise exception 'not_substitutable: solo se cambian ingredientes del plan que aún no compraste' using errcode = 'P0001';
  end if;

  select s.ratio into v_ratio from public.ingredient_substitutions s
  where s.ingredient_id = v_item.ingredient_id and s.substitute_id = p_substitute_id;
  if v_ratio is null or private.ingredient_blocked_for_user(p_substitute_id, v_user) then
    raise exception 'not_substitutable: ese sustituto no aplica para ti' using errcode = 'P0001';
  end if;

  insert into public.shopping_list_substitutions (list_id, ingredient_id, substitute_id, ratio)
  values (v_item.list_id, v_item.ingredient_id, p_substitute_id, v_ratio)
  on conflict (list_id, ingredient_id) do update set substitute_id = excluded.substitute_id, ratio = excluded.ratio;

  perform public.generate_shopping_list(v_item.plan_id);   -- quita el original y suma el sustituto
end $$;

create function public.undo_shopping_substitution(p_item_id uuid)
returns void
language plpgsql set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_item record;
begin
  select sli.list_id, sli.ingredient_id, l.plan_id into v_item
  from public.shopping_list_items sli join public.shopping_lists l on l.id = sli.list_id
  where sli.id = p_item_id and l.user_id = v_user;
  if not found then
    raise exception 'list_not_found' using errcode = 'P0002';
  end if;

  delete from public.shopping_list_substitutions
  where list_id = v_item.list_id and substitute_id = v_item.ingredient_id;
  if v_item.plan_id is not null then
    perform public.generate_shopping_list(v_item.plan_id);
  end if;
end $$;

-- La lista muestra "en lugar de …" para lo sustituido.
create or replace view public.my_shopping_items with (security_invoker = true) as
select sli.id, sli.list_id, sli.ingredient_id,
       coalesce(i.name, sli.custom_name) as name,
       c.id as category_id, c.name as category_name,
       coalesce(uso.position, c.sort_order, 99)::int as category_position,
       sli.needed_g, sli.pantry_g, sli.to_buy_g, sli.is_checked, sli.source, sli.moved_to_pantry_at,
       case when uw.grams is not null and sli.to_buy_g > 0 then ceil(sli.to_buy_g / uw.grams)::int end as approx_units,
       (select string_agg(oi.name, ', ' order by oi.name)
          from public.shopping_list_substitutions sub join public.ingredients oi on oi.id = sub.ingredient_id
         where sub.list_id = sli.list_id and sub.substitute_id = sli.ingredient_id) as replaces_name
from public.shopping_list_items sli
left join public.ingredients i on i.id = sli.ingredient_id
left join public.ingredient_categories c on c.id = coalesce(i.store_category_id, sli.store_category_id)
left join public.user_section_order uso on uso.store_category_id = c.id and uso.user_id = (select auth.uid())
left join public.ingredient_unit_weights uw
       on uw.ingredient_id = sli.ingredient_id and uw.unit_id = (select u.id from public.units u where u.code = 'unit');

revoke execute on function public.suggest_substitutes_for(uuid[]) from public, anon;
revoke execute on function public.substitute_shopping_item(uuid, uuid) from public, anon;
revoke execute on function public.undo_shopping_substitution(uuid) from public, anon;
grant execute on function public.suggest_substitutes_for(uuid[]) to authenticated, service_role;
grant execute on function public.substitute_shopping_item(uuid, uuid) to authenticated, service_role;
grant execute on function public.undo_shopping_substitution(uuid) to authenticated, service_role;

-- ---- Catálogo de sustitutos (mismo contenido que catalog/04_substitutions.sql) ----------------
insert into public.ingredient_substitutions (ingredient_id, substitute_id, ratio, note)
select a.id, b.id, v.r, v.n
from (values
  ('Pechuga de pollo', 'Muslo de pollo', 1, null),
  ('Muslo de pollo', 'Pechuga de pollo', 1, 'Queda un poco más seca: no la cocines de más.'),
  ('Carne de res molida', 'Carne de res para sudar', 1, 'Pícala bien fina.'),
  ('Carne de res para sudar', 'Carne de res molida', 1, 'Se cocina más rápido.'),
  ('Atún en lata', 'Sardinas en lata', 1, null),
  ('Sardinas en lata', 'Atún en lata', 1, null),
  ('Fríjol rojo seco', 'Fríjol cocido', 2.5, 'Ya cocido: agrégalo al final, sin remojar.'),
  ('Fríjol cocido', 'Garbanzos cocidos', 1, null),
  ('Garbanzos cocidos', 'Fríjol cocido', 1, null),
  ('Lentejas secas', 'Fríjol rojo seco', 1, 'El fríjol necesita remojo y más cocción.'),
  ('Papa', 'Papa criolla', 1, 'Se deshace más rápido: agrégala después.'),
  ('Papa', 'Yuca', 1, 'Necesita más cocción.'),
  ('Papa criolla', 'Papa', 1, null),
  ('Yuca', 'Papa', 1, null),
  ('Plátano verde', 'Yuca', 1, null),
  ('Cebolla larga', 'Cebolla cabezona', 1, null),
  ('Cebolla cabezona', 'Cebolla larga', 1, null),
  ('Habichuela', 'Arveja verde', 1, null),
  ('Arveja verde', 'Habichuela', 1, null),
  ('Pan blanco', 'Arepa de maíz', 1, null),
  ('Arepa de maíz', 'Pan blanco', 1, null),
  ('Leche entera', 'Agua', 1, 'Para avena o caldos: queda menos cremoso.'),
  ('Banano', 'Mango', 1, null),
  ('Mango', 'Banano', 1, null),
  ('Fresa', 'Mango', 1, null),
  ('Manzana', 'Banano', 1, null)
) v(a, b, r, n)
join public.ingredients a on a.name = v.a
join public.ingredients b on b.name = v.b
on conflict do nothing;
