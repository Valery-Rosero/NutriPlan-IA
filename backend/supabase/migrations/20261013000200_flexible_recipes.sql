-- =============================================================================
-- 0013 · Recetas versátiles (ADR-020) y guardado atómico del plan (R9)
-- Una receta tiene una BASE fija (recipe_ingredients) y GRUPOS intercambiables
-- ("Proteína: pollo | cerdo | huevo | fríjol"). Cada grupo se resuelve con lo que la
-- familia tiene en la despensa; si no hay nada, con la opción por defecto.
-- La seguridad no cambia: una opción con un alérgeno o fuera de la dieta nunca se elige,
-- y una receta solo es elegible si TODOS sus grupos obligatorios tienen opciones seguras.
-- =============================================================================

-- ---- Básicos de cocina ------------------------------------------------------
alter table public.ingredients add column is_staple boolean not null default false;
comment on column public.ingredients.is_staple is
  'Básico que casi toda cocina tiene (sal, aceite, especias). "¿Qué cocino con lo que tengo?" lo da por disponible.';

-- ---- Grupos y opciones ------------------------------------------------------
create table public.recipe_flex_groups (
  recipe_id   uuid     not null references public.recipes(id) on delete cascade,
  group_key   smallint not null check (group_key > 0),
  label       text     not null check (char_length(label) between 2 and 60),
  min_choices smallint not null default 1 check (min_choices between 0 and 5),
  max_choices smallint not null default 1 check (max_choices between 1 and 5),
  sort_order  smallint not null default 0,
  primary key (recipe_id, group_key),
  check (max_choices >= min_choices)
);
comment on table public.recipe_flex_groups is
  'Grupo intercambiable de una receta. min_choices = 0: grupo opcional (se usa solo si lo tienes).';

create table public.recipe_flex_options (
  recipe_id        uuid     not null,
  group_key        smallint not null,
  ingredient_id    uuid     not null references public.ingredients(id),
  quantity         numeric(10,3) not null check (quantity > 0),
  unit_id          smallint not null references public.units(id),
  scaling_exponent numeric(3,2) not null default 1.00 check (scaling_exponent between 0 and 1),
  is_default       boolean  not null default false,
  notes            text,
  primary key (recipe_id, group_key, ingredient_id),
  foreign key (recipe_id, group_key) references public.recipe_flex_groups (recipe_id, group_key) on delete cascade
);
create index recipe_flex_options_ingredient_idx on public.recipe_flex_options (ingredient_id);
comment on column public.recipe_flex_options.quantity is
  'Cantidad si es la ÚNICA opción elegida del grupo a las porciones base. Con k opciones elegidas, cada una aporta quantity/k.';

-- Lo que se eligió para una comida planeada. recipe_id repite planned_meals.recipe_id a propósito:
-- es la única forma de que la FK garantice que la opción pertenece a esa receta (el trigger exige que coincidan).
create table public.planned_meal_choices (
  planned_meal_id uuid     not null references public.planned_meals(id) on delete cascade,
  recipe_id       uuid     not null,
  group_key       smallint not null,
  ingredient_id   uuid     not null,
  is_auto         boolean  not null default false,
  primary key (planned_meal_id, group_key, ingredient_id),
  foreign key (recipe_id, group_key, ingredient_id)
    references public.recipe_flex_options (recipe_id, group_key, ingredient_id) on delete cascade
);
comment on column public.planned_meal_choices.is_auto is
  'true = la fijó el sistema al cocinar (se borra al deshacer). false = la eligió la persona.';

-- ---- Núcleo: ¿una opción excluida por una dieta? -----------------------------
create function private.ingredient_excluded_by_diet(p_ingredient_id uuid, p_diet_id smallint)
returns boolean language sql stable set search_path = '' as $$
  select exists (select 1 from public.ingredients i
                 join public.diet_excluded_food_groups x on x.food_group_id = i.food_group_id
                 where i.id = p_ingredient_id and x.diet_id = p_diet_id)
      or exists (select 1 from public.ingredient_allergens ia
                 join public.diet_excluded_allergens xa on xa.allergen_id = ia.allergen_id
                 where ia.ingredient_id = p_ingredient_id and xa.diet_id = p_diet_id)
$$;

create function private.in_pantry(p_user_id uuid, p_ingredient_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.pantry_items pi
                 where pi.user_id = p_user_id and pi.ingredient_id = p_ingredient_id and pi.quantity_g > 0
                   and (pi.expires_on is null or pi.expires_on >= current_date))
$$;

-- Alérgenos: la base (incluidos opcionales) o un grupo obligatorio sin opciones seguras suficientes.
create or replace function private.recipe_conflicts_with_user(p_recipe_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
           select 1
           from public.recipe_ingredients ri
           join public.ingredient_allergens ia on ia.ingredient_id = ri.ingredient_id
           join public.user_allergens ua       on ua.allergen_id   = ia.allergen_id
           where ri.recipe_id = p_recipe_id and ua.user_id = p_user_id)
      or exists (
           select 1 from public.recipe_flex_groups g
           where g.recipe_id = p_recipe_id and g.min_choices > 0
             and (select count(*) from public.recipe_flex_options o
                  where o.recipe_id = g.recipe_id and o.group_key = g.group_key
                    and not exists (select 1 from public.ingredient_allergens ia
                                    join public.user_allergens ua on ua.allergen_id = ia.allergen_id
                                    where ia.ingredient_id = o.ingredient_id and ua.user_id = p_user_id)) < g.min_choices)
$$;

-- Dietas compatibles: la base entera y, en cada grupo obligatorio, suficientes opciones compatibles.
create or replace view public.recipe_diets with (security_invoker = true) as
select r.id as recipe_id, d.id as diet_id
from public.recipes r
cross join public.diets d
where (d.kind = 'rule_based'
       and not exists (select 1 from public.recipe_ingredients ri
                       where ri.recipe_id = r.id and private.ingredient_excluded_by_diet(ri.ingredient_id, d.id))
       and not exists (select 1 from public.recipe_flex_groups g
                       where g.recipe_id = r.id and g.min_choices > 0
                         and (select count(*) from public.recipe_flex_options o
                              where o.recipe_id = g.recipe_id and o.group_key = g.group_key
                                and not private.ingredient_excluded_by_diet(o.ingredient_id, d.id)) < g.min_choices))
   or (d.kind = 'curated' and exists (
         select 1 from public.recipe_diet_tags t where t.recipe_id = r.id and t.diet_id = d.id));

-- Bloqueo total para un usuario: alérgenos, dietas, o un grupo que no se puede completar
-- combinando ambas restricciones (p. ej. la única opción sin huevo es carne y la persona es vegetariana).
create function private.recipe_blocked_for_user(p_recipe_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.recipe_conflicts_with_user(p_recipe_id, p_user_id)
      or private.recipe_violates_user_diets(p_recipe_id, p_user_id)
      or exists (
           select 1 from public.recipe_flex_groups g
           where g.recipe_id = p_recipe_id and g.min_choices > 0
             and (select count(*) from public.recipe_flex_options o
                  where o.recipe_id = g.recipe_id and o.group_key = g.group_key
                    and not private.ingredient_blocked_for_user(o.ingredient_id, p_user_id)) < g.min_choices)
$$;

-- Alérgenos visibles en la receta; only_in_options = solo aparece en opciones intercambiables.
create or replace view public.recipe_allergens with (security_invoker = true) as
select x.recipe_id, x.allergen_id, bool_and(x.from_option) as only_in_options
from (
  select ri.recipe_id, ia.allergen_id, false as from_option
  from public.recipe_ingredients ri join public.ingredient_allergens ia on ia.ingredient_id = ri.ingredient_id
  union all
  select o.recipe_id, ia.allergen_id, true
  from public.recipe_flex_options o join public.ingredient_allergens ia on ia.ingredient_id = o.ingredient_id
) x
group by x.recipe_id, x.allergen_id;

-- ---- Resolución de grupos: primero lo que hay en la despensa ----------------
-- Por grupo: elecciones explícitas válidas de la comida; si no hay, candidatos seguros ordenados por
-- (en despensa, vence antes, no le disgusta, por defecto, nombre). Se toman min_choices, o más
-- (hasta max_choices) si hay varios en la despensa. Grupo opcional: solo lo que haya en despensa.
-- p_user_id nulo = resolución de catálogo (solo opciones por defecto).
create function private.resolve_flex(p_recipe_id uuid, p_user_id uuid, p_planned_meal_id uuid default null)
returns table (group_key smallint, ingredient_id uuid, share numeric)
language sql stable security definer set search_path = '' as $$
  with grp as (
    select g.group_key, g.min_choices, g.max_choices
    from public.recipe_flex_groups g where g.recipe_id = p_recipe_id
  ),
  explicit as (
    select c.group_key, c.ingredient_id
    from public.planned_meal_choices c
    where p_planned_meal_id is not null and c.planned_meal_id = p_planned_meal_id and c.recipe_id = p_recipe_id
      and (p_user_id is null or not private.ingredient_blocked_for_user(c.ingredient_id, p_user_id))
  ),
  cand as (
    select o.group_key, o.ingredient_id, o.is_default, i.name,
           (p_user_id is not null and st.grams > 0) as in_pantry, st.first_expiry,
           exists (select 1 from public.user_disliked_ingredients d
                   where d.user_id = p_user_id and d.ingredient_id = o.ingredient_id) as disliked
    from public.recipe_flex_options o
    join public.ingredients i on i.id = o.ingredient_id
    cross join lateral (
      select coalesce(sum(pi.quantity_g), 0) as grams, min(pi.expires_on) as first_expiry
      from public.pantry_items pi
      where pi.user_id = p_user_id and pi.ingredient_id = o.ingredient_id and pi.quantity_g > 0
        and (pi.expires_on is null or pi.expires_on >= current_date)
    ) st
    where o.recipe_id = p_recipe_id
      and not exists (select 1 from explicit e where e.group_key = o.group_key)
      and (p_user_id is null or not private.ingredient_blocked_for_user(o.ingredient_id, p_user_id))
  ),
  ranked as (
    select c.group_key, c.ingredient_id,
           row_number() over (partition by c.group_key
                              order by c.in_pantry desc, c.first_expiry nulls last, c.disliked, c.is_default desc, c.name) as rn,
           count(*) filter (where c.in_pantry) over (partition by c.group_key) as n_pantry
    from cand c
  ),
  picked as (
    select r.group_key, r.ingredient_id
    from ranked r join grp g on g.group_key = r.group_key
    where r.rn <= greatest(g.min_choices, least(r.n_pantry, g.max_choices))
    union all
    select e.group_key, e.ingredient_id from explicit e
  )
  select p.group_key, p.ingredient_id, round(1.0 / count(*) over (partition by p.group_key), 4)
  from picked p
$$;

-- Líneas concretas de una receta (base + grupos resueltos), escaladas y en gramos.
create function private.recipe_lines(p_recipe_id uuid, p_servings numeric, p_user_id uuid,
                                     p_planned_meal_id uuid default null)
returns table (ingredient_id uuid, ingredient_name text, is_optional boolean, quantity numeric,
               unit_id smallint, unit_code text, grams numeric, group_key smallint, group_label text)
language plpgsql stable set search_path = '' as $$
declare v_base smallint;
begin
  if p_servings is null or p_servings <= 0 then
    raise exception 'invalid_servings: las porciones deben ser mayores que 0' using errcode = '22023';
  end if;
  select r.base_servings into v_base from public.recipes r where r.id = p_recipe_id;
  if not found then
    raise exception 'recipe_not_found' using errcode = 'P0002';
  end if;

  return query
  with lines as (
    select ri.ingredient_id, ri.is_optional, ri.quantity, ri.unit_id, ri.scaling_exponent,
           ri.sort_order::int as sort_key, null::smallint as group_key, null::text as group_label
    from public.recipe_ingredients ri where ri.recipe_id = p_recipe_id
    union all
    select o.ingredient_id, false, o.quantity * rf.share, o.unit_id, o.scaling_exponent,
           1000 + g.sort_order * 10 + g.group_key, g.group_key, g.label
    from private.resolve_flex(p_recipe_id, p_user_id, p_planned_meal_id) rf
    join public.recipe_flex_options o on o.recipe_id = p_recipe_id and o.group_key = rf.group_key
                                     and o.ingredient_id = rf.ingredient_id
    join public.recipe_flex_groups g  on g.recipe_id = p_recipe_id and g.group_key = rf.group_key
  )
  select l.ingredient_id, i.name, l.is_optional, q.qty, l.unit_id, u.code,
         round(private.to_grams(l.ingredient_id, q.qty, l.unit_id), 2), l.group_key, l.group_label
  from lines l
  join public.ingredients i on i.id = l.ingredient_id
  join public.units u       on u.id = l.unit_id
  cross join lateral (select coalesce(i.rounding_step, u.rounding_step) as s) st
  cross join lateral (
    select greatest(st.s, round(l.quantity * power(p_servings / v_base, l.scaling_exponent) / st.s) * st.s) as qty
  ) q
  order by l.sort_key, i.name;
end $$;

-- ---- Funciones públicas de receta -------------------------------------------
-- scale_recipe ahora incluye los grupos resueltos con la despensa de quien consulta.
drop function public.scale_recipe(uuid, numeric);
create function public.scale_recipe(p_recipe_id uuid, p_servings numeric)
returns table (ingredient_id uuid, ingredient_name text, is_optional boolean, quantity numeric,
               unit_id smallint, unit_code text, grams numeric, group_key smallint, group_label text)
language sql stable set search_path = '' as $$
  select * from private.recipe_lines(p_recipe_id, p_servings, (select auth.uid()), null)
$$;

-- Ingredientes de una comida planeada (con las elecciones de la persona o la resolución por despensa).
create function public.scale_planned_meal(p_planned_meal_id uuid)
returns table (ingredient_id uuid, ingredient_name text, is_optional boolean, quantity numeric,
               unit_id smallint, unit_code text, grams numeric, group_key smallint, group_label text)
language plpgsql stable set search_path = '' as $$
declare v_pm public.planned_meals;
begin
  select pm.* into v_pm from public.planned_meals pm where pm.id = p_planned_meal_id;   -- RLS: solo las propias
  if not found then
    raise exception 'meal_not_found' using errcode = 'P0002';
  end if;
  return query select * from private.recipe_lines(v_pm.recipe_id, v_pm.servings, (select auth.uid()), v_pm.id);
end $$;

-- Menú de opciones para la UI: solo opciones seguras para quien consulta, con lo que tiene y lo elegido.
create function public.recipe_flex_menu(p_recipe_id uuid, p_planned_meal_id uuid default null)
returns table (group_key smallint, group_label text, min_choices smallint, max_choices smallint,
               ingredient_id uuid, ingredient_name text, in_pantry boolean, is_default boolean, selected boolean)
language sql stable set search_path = '' as $$
  with me as (select (select auth.uid()) as uid),
  pm as (select x.id from public.planned_meals x where x.id = p_planned_meal_id),   -- RLS: solo si es propia
  sel as (select rf.group_key, rf.ingredient_id
          from me, private.resolve_flex(p_recipe_id, me.uid, (select pm.id from pm)) rf)
  select g.group_key, g.label, g.min_choices, g.max_choices, o.ingredient_id, i.name,
         private.in_pantry(me.uid, o.ingredient_id), o.is_default,
         exists (select 1 from sel s where s.group_key = g.group_key and s.ingredient_id = o.ingredient_id)
  from me
  join public.recipe_flex_groups g on g.recipe_id = p_recipe_id
  join public.recipe_flex_options o on o.recipe_id = g.recipe_id and o.group_key = g.group_key
  join public.ingredients i on i.id = o.ingredient_id
  where exists (select 1 from public.recipes r where r.id = p_recipe_id)                 -- RLS de recetas
    and not private.ingredient_blocked_for_user(o.ingredient_id, me.uid)
  order by g.sort_order, g.group_key, i.name
$$;

-- La persona elige qué usar en un grupo ("hoy hay cerdo"). Un arreglo vacío vuelve a la elección automática.
create function public.set_meal_choices(p_planned_meal_id uuid, p_group_key smallint, p_ingredient_ids uuid[])
returns void language plpgsql set search_path = '' as $$
declare
  v_pm  public.planned_meals;
  v_min smallint;
  v_n   integer := coalesce(cardinality(p_ingredient_ids), 0);
begin
  select pm.* into v_pm
  from public.planned_meals pm join public.meal_plans p on p.id = pm.plan_id
  where pm.id = p_planned_meal_id and p.user_id = (select auth.uid())
  for update of pm;
  if not found then
    raise exception 'meal_not_found' using errcode = 'P0002';
  end if;
  if v_pm.status <> 'planned' then
    raise exception 'meal_not_pending: la comida ya fue cocinada u omitida' using errcode = 'P0001';
  end if;
  select g.min_choices into v_min from public.recipe_flex_groups g
  where g.recipe_id = v_pm.recipe_id and g.group_key = p_group_key;
  if not found then
    raise exception 'group_not_found' using errcode = 'P0002';
  end if;
  if v_n > 0 and v_n < v_min then
    raise exception 'too_few_choices: este grupo necesita al menos % opciones', v_min using errcode = 'P0001';
  end if;

  delete from public.planned_meal_choices where planned_meal_id = p_planned_meal_id and group_key = p_group_key;
  insert into public.planned_meal_choices (planned_meal_id, recipe_id, group_key, ingredient_id)
  select p_planned_meal_id, v_pm.recipe_id, p_group_key, x from unnest(p_ingredient_ids) x;
end $$;

-- Validación de cada elección: misma receta, comida pendiente, opción segura y sin pasar el máximo.
create function private.validate_meal_choice()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_recipe uuid; v_status public.meal_status; v_owner uuid; v_max smallint;
begin
  select pm.recipe_id, pm.status, p.user_id into v_recipe, v_status, v_owner
  from public.planned_meals pm join public.meal_plans p on p.id = pm.plan_id
  where pm.id = new.planned_meal_id;
  if v_recipe is distinct from new.recipe_id then
    raise exception 'choice_recipe_mismatch: la opción no pertenece a la receta de esta comida' using errcode = 'P0001';
  end if;
  if v_status <> 'planned' then
    raise exception 'meal_not_pending: la comida ya fue cocinada u omitida' using errcode = 'P0001';
  end if;
  if private.ingredient_blocked_for_user(new.ingredient_id, v_owner) then
    raise exception 'choice_blocked: esa opción tiene un alérgeno o no es compatible con tu dieta' using errcode = 'P0001';
  end if;
  select g.max_choices into v_max from public.recipe_flex_groups g
  where g.recipe_id = new.recipe_id and g.group_key = new.group_key;
  if (select count(*) from public.planned_meal_choices c
      where c.planned_meal_id = new.planned_meal_id and c.group_key = new.group_key
        and c.ingredient_id <> new.ingredient_id) >= v_max then
    raise exception 'too_many_choices: este grupo admite máximo % opciones', v_max using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger planned_meal_choices_validate before insert or update on public.planned_meal_choices
  for each row execute function private.validate_meal_choice();

-- Si cambia la receta de la comida, las elecciones de la anterior ya no aplican.
create function private.clear_choices_on_recipe_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.planned_meal_choices where planned_meal_id = new.id and recipe_id <> new.recipe_id;
  return new;
end $$;
create trigger planned_meals_clear_choices after update of recipe_id on public.planned_meals
  for each row execute function private.clear_choices_on_recipe_change();

-- ---- Elegibilidad: un solo criterio de bloqueo -------------------------------
create or replace function public.eligible_recipes(p_slot public.meal_slot default null, p_max_minutes integer default null)
returns setof public.recipes
language sql stable set search_path = '' as $$
  select r.*
  from public.recipes r
  cross join (
    select p.id, p.max_cook_minutes, p.spice_tolerance, p.batch_cooking
    from public.profiles p where p.id = (select auth.uid())
  ) me
  where r.status = 'published'
    and (p_slot is null or exists (select 1 from public.recipe_meal_slots s where s.recipe_id = r.id and s.slot = p_slot))
    and r.total_minutes <= coalesce(p_max_minutes, me.max_cook_minutes, 32767)
    -- ALERGIAS y DIETAS (duro): base, opciones y grupos que se puedan completar con seguridad
    and not private.recipe_blocked_for_user(r.id, me.id)
    -- ingredientes de la BASE que no le gustan (blando; en los grupos solo bajan de prioridad)
    and not exists (
      select 1 from public.recipe_ingredients ri
      join public.user_disliked_ingredients dis on dis.ingredient_id = ri.ingredient_id
      where ri.recipe_id = r.id and dis.user_id = me.id and not ri.is_optional)
    and coalesce((select mh.heat_level from public.recipe_max_heat mh where mh.recipe_id = r.id), 0) <= me.spice_tolerance
    and not exists (
      select 1 from public.recipe_ratings rr
      where rr.user_id = me.id and rr.recipe_id = r.id and rr.rating <= 2
        and rr.rated_at > now() - interval '60 days')
    and (not me.batch_cooking or p_slot is null or p_slot not in ('lunch', 'dinner')
         or (r.base_servings >= 4 and r.keeps_days is not null))
$$;

create or replace function private.validate_planned_meal()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_plan   record;
  v_status public.recipe_status;
begin
  select user_id, start_date, end_date into v_plan from public.meal_plans where id = new.plan_id;
  if not found then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if new.meal_date < v_plan.start_date or new.meal_date > v_plan.end_date then
    raise exception 'meal_date_out_of_plan: la fecha queda fuera del rango del plan' using errcode = '22023';
  end if;
  select status into v_status from public.recipes where id = new.recipe_id;
  if v_status is distinct from 'published' then
    raise exception 'recipe_not_published: solo se pueden planear recetas publicadas' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.recipe_meal_slots s where s.recipe_id = new.recipe_id and s.slot = new.slot) then
    raise exception 'slot_mismatch: la receta no corresponde a este tipo de comida' using errcode = 'P0001';
  end if;
  if private.recipe_conflicts_with_user(new.recipe_id, v_plan.user_id) then
    raise exception 'allergen_conflict: la receta contiene un alérgeno que el usuario declaró' using errcode = 'P0001';
  end if;
  if private.recipe_blocked_for_user(new.recipe_id, v_plan.user_id) then
    raise exception 'diet_conflict: la receta no es compatible con la dieta del usuario' using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace view public.my_plan_conflicts with (security_invoker = true) as
select pm.id as planned_meal_id, pm.plan_id, pm.meal_date, pm.slot, pm.recipe_id,
       case when private.recipe_conflicts_with_user(pm.recipe_id, p.user_id) then 'allergen' else 'diet' end as conflict
from public.planned_meals pm
join public.meal_plans p on p.id = pm.plan_id
where pm.status = 'planned'
  and pm.meal_date >= current_date
  and private.recipe_blocked_for_user(pm.recipe_id, p.user_id);

create or replace function private.purge_favorites_on_new_allergen()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.favorite_recipes f
  where f.user_id = new.user_id and private.recipe_conflicts_with_user(f.recipe_id, new.user_id);
  return new;
end $$;

-- ---- Publicación y edición ---------------------------------------------------
create or replace function private.enforce_recipe_publishable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.recipe_ingredients where recipe_id = new.id)
     and not exists (select 1 from public.recipe_flex_groups where recipe_id = new.id) then
    raise exception 'recipe_incomplete: la receta no tiene ingredientes' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.recipe_steps where recipe_id = new.id) then
    raise exception 'recipe_incomplete: la receta no tiene pasos' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.recipe_meal_slots where recipe_id = new.id) then
    raise exception 'recipe_incomplete: la receta no tiene tipo de comida' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.recipe_flex_groups g
             where g.recipe_id = new.id
               and (select count(*) from public.recipe_flex_options o
                    where o.recipe_id = g.recipe_id and o.group_key = g.group_key) < greatest(g.min_choices, 1)) then
    raise exception 'recipe_incomplete: un grupo intercambiable no tiene opciones suficientes' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from (select ingredient_id from public.recipe_ingredients where recipe_id = new.id
                   union select ingredient_id from public.recipe_flex_options where recipe_id = new.id) x
    left join public.ingredient_nutrition n on n.ingredient_id = x.ingredient_id
    where n.ingredient_id is null
  ) then
    raise exception 'recipe_missing_nutrition: hay ingredientes sin datos nutricionales' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from (select ingredient_id from public.recipe_ingredients where recipe_id = new.id
                   union select ingredient_id from public.recipe_flex_options where recipe_id = new.id) x
    join public.ingredients i on i.id = x.ingredient_id
    where i.allergens_reviewed_at is null
  ) then
    raise exception 'allergens_unreviewed: hay ingredientes sin revisión de alérgenos' using errcode = 'P0001';
  end if;

  if new.author_id is null then
    if coalesce((select outcome from public.nutritionist_reviews
                  where recipe_id = new.id order by reviewed_at desc limit 1), 'rejected') <> 'approved' then
      raise exception 'review_required: la receta oficial necesita una revisión nutricional aprobada' using errcode = 'P0001';
    end if;
  elsif not private.has_consent(new.author_id, 'community_sharing') then
    raise exception 'consent_required: el autor no ha aceptado compartir en la comunidad' using errcode = 'P0001';
  end if;

  new.published_at := coalesce(new.published_at, now());
  return new;
end $$;

create trigger recipe_flex_groups_locked before insert or update or delete on public.recipe_flex_groups
  for each row execute function private.block_published_recipe_edits();
create trigger recipe_flex_options_locked before insert or update or delete on public.recipe_flex_options
  for each row execute function private.block_published_recipe_edits();
create trigger recipe_flex_options_convertible
  before insert or update of ingredient_id, quantity, unit_id on public.recipe_flex_options
  for each row execute function private.check_recipe_ingredient_convertible();

-- ---- Nutrición de catálogo: base + opciones por defecto ----------------------
create or replace view public.recipe_nutrition with (security_invoker = true) as
select r.id as recipe_id,
       round(sum(l.grams / 100 * n.kcal)      / r.base_servings, 1) as kcal_per_serving,
       round(sum(l.grams / 100 * n.protein_g) / r.base_servings, 1) as protein_g_per_serving,
       round(sum(l.grams / 100 * n.carbs_g)   / r.base_servings, 1) as carbs_g_per_serving,
       round(sum(l.grams / 100 * n.fat_g)     / r.base_servings, 1) as fat_g_per_serving,
       round(sum(l.grams / 100 * n.fiber_g)   / r.base_servings, 1) as fiber_g_per_serving,
       round(sum(l.grams / 100 * n.sugar_g)   / r.base_servings, 1) as sugar_g_per_serving,
       round(sum(l.grams / 100 * n.sodium_mg) / r.base_servings, 0) as sodium_mg_per_serving,
       (count(*) filter (where n.ingredient_id is null))::int       as ingredients_missing_nutrition
from public.recipes r
cross join lateral (
  select ri.ingredient_id, private.to_grams(ri.ingredient_id, ri.quantity, ri.unit_id) as grams
  from public.recipe_ingredients ri where ri.recipe_id = r.id and not ri.is_optional
  union all
  select o.ingredient_id, private.to_grams(o.ingredient_id, o.quantity * rf.share, o.unit_id)
  from private.resolve_flex(r.id, null, null) rf
  join public.recipe_flex_options o on o.recipe_id = r.id and o.group_key = rf.group_key and o.ingredient_id = rf.ingredient_id
) l
left join public.ingredient_nutrition n on n.ingredient_id = l.ingredient_id
group by r.id, r.base_servings;

-- ---- Despensa, compras, presupuesto y cocina usan las líneas resueltas -------
create or replace function public.recipe_pantry_match(p_recipe_id uuid)
returns table (matched_ingredients integer, total_ingredients integer, coverage numeric)
language sql stable set search_path = '' as $$
  with me as (select (select auth.uid()) as uid),
  req as (
    select private.in_pantry(me.uid, ri.ingredient_id) or i.is_staple as ok
    from me, public.recipe_ingredients ri join public.ingredients i on i.id = ri.ingredient_id
    where ri.recipe_id = p_recipe_id and not ri.is_optional
    union all
    select exists (select 1 from public.recipe_flex_options o
                   where o.recipe_id = g.recipe_id and o.group_key = g.group_key
                     and private.in_pantry(me.uid, o.ingredient_id)
                     and not private.ingredient_blocked_for_user(o.ingredient_id, me.uid))
    from me, public.recipe_flex_groups g
    where g.recipe_id = p_recipe_id and g.min_choices > 0
  )
  select (count(*) filter (where ok))::int, count(*)::int,
         case when count(*) = 0 then 0 else round((count(*) filter (where ok))::numeric / count(*), 2) end
  from req
$$;

create or replace function public.recipes_using_expiring_ingredients(p_within_days integer default 3)
returns table (pantry_item_id uuid, ingredient_id uuid, ingredient_name text, expires_on date,
               days_left integer, recipe_id uuid, recipe_title text)
language sql stable set search_path = '' as $$
  select pi.id, pi.ingredient_id, i.name, pi.expires_on, (pi.expires_on - current_date)::int, rec.id, rec.title
  from public.pantry_items pi
  join public.ingredients i on i.id = pi.ingredient_id
  cross join lateral (
    select er.id, er.title
    from public.eligible_recipes() er
    where exists (select 1 from public.recipe_ingredients ri
                  where ri.recipe_id = er.id and ri.ingredient_id = pi.ingredient_id and not ri.is_optional)
       or exists (select 1 from public.recipe_flex_options o
                  where o.recipe_id = er.id and o.ingredient_id = pi.ingredient_id)
    order by er.total_minutes, er.title
    limit 3
  ) rec
  where pi.user_id = (select auth.uid())
    and pi.quantity_g > 0
    and pi.expires_on between current_date and current_date + p_within_days
  order by pi.expires_on, i.name, rec.title
$$;

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
    where pm.plan_id = p_plan_id and pm.status = 'planned' and not l.is_optional
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
    where pm.plan_id = p_plan_id and pm.status <> 'skipped' and not l.is_optional
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

-- Cocinar: congela la resolución (para deshacer e historial exactos) y descuenta por vencimiento.
create or replace function public.mark_meal_cooked(p_planned_meal_id uuid)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_user  uuid := (select auth.uid());
  v_pm    public.planned_meals;
  v_line  record;
  v_batch record;
  v_need  numeric;
  v_take  numeric;
  v_total numeric := 0;
  v_short jsonb := '[]'::jsonb;
begin
  select pm.* into v_pm
  from public.planned_meals pm join public.meal_plans p on p.id = pm.plan_id
  where pm.id = p_planned_meal_id and p.user_id = v_user
  for update of pm;
  if not found then
    raise exception 'meal_not_found' using errcode = 'P0002';
  end if;
  if v_pm.status <> 'planned' then
    raise exception 'meal_not_pending: la comida ya fue cocinada u omitida' using errcode = 'P0001';
  end if;

  -- una elección que hoy choca con una alergia o dieta se descarta (se resuelve de nuevo con opciones seguras)
  delete from public.planned_meal_choices c
  where c.planned_meal_id = p_planned_meal_id and private.ingredient_blocked_for_user(c.ingredient_id, v_user);
  insert into public.planned_meal_choices (planned_meal_id, recipe_id, group_key, ingredient_id, is_auto)
  select p_planned_meal_id, v_pm.recipe_id, rf.group_key, rf.ingredient_id, true
  from private.resolve_flex(v_pm.recipe_id, v_user, p_planned_meal_id) rf
  where not exists (select 1 from public.planned_meal_choices c
                    where c.planned_meal_id = p_planned_meal_id and c.group_key = rf.group_key);

  for v_line in
    select l.ingredient_id, min(l.ingredient_name) as ingredient_name, sum(l.grams) as grams
    from private.recipe_lines(v_pm.recipe_id, v_pm.servings, v_user, p_planned_meal_id) l
    where not l.is_optional
    group by l.ingredient_id
  loop
    v_need := v_line.grams;
    for v_batch in
      select pi.id, pi.quantity_g from public.pantry_items pi
      where pi.user_id = v_user and pi.ingredient_id = v_line.ingredient_id
        and pi.quantity_g > 0 and (pi.expires_on is null or pi.expires_on >= current_date)
      order by pi.expires_on nulls last, pi.created_at
      for update
    loop
      exit when v_need <= 0;
      v_take := least(v_batch.quantity_g, v_need);
      update public.pantry_items set quantity_g = quantity_g - v_take where id = v_batch.id;
      insert into public.meal_pantry_deductions (planned_meal_id, pantry_item_id, grams)
      values (p_planned_meal_id, v_batch.id, v_take);
      v_need  := v_need - v_take;
      v_total := v_total + v_take;
    end loop;
    if v_need > 0.005 then
      v_short := v_short || jsonb_build_object('ingredient_id', v_line.ingredient_id,
                                               'ingredient_name', v_line.ingredient_name,
                                               'missing_g', round(v_need, 2));
    end if;
  end loop;

  update public.planned_meals set status = 'cooked', cooked_at = now() where id = p_planned_meal_id;
  return jsonb_build_object('planned_meal_id', p_planned_meal_id,
                            'deducted_g', round(v_total, 2),
                            'shortfall', v_short);
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
  update public.planned_meals set status = 'planned', cooked_at = null where id = p_planned_meal_id;
  delete from public.planned_meal_choices where planned_meal_id = p_planned_meal_id and is_auto;
end $$;

-- ---- "¿Qué cocino con lo que tengo?" ----------------------------------------
-- Recetas elegibles ordenadas por cuánto cubre la despensa (los básicos cuentan como disponibles),
-- con la lista exacta de lo que falta. Es la pantalla principal de la app.
create function public.cook_with_what_i_have(p_slot public.meal_slot default null,
                                             p_servings numeric default null, p_limit integer default 10)
returns table (recipe_id uuid, title text, total_minutes smallint, coverage numeric,
               missing_count integer, missing jsonb, uses_expiring boolean)
language sql stable set search_path = '' as $$
  with me as (
    select p.id, p.household_size from public.profiles p where p.id = (select auth.uid())
  ),
  rec as (select e.id, e.title, e.total_minutes from public.eligible_recipes(p_slot) e),
  lines as (
    select r.id as recipe_id, l.ingredient_id, l.ingredient_name, sum(l.grams) as grams,
           bool_or(i.is_staple) as is_staple
    from rec r cross join me
    cross join lateral private.recipe_lines(r.id, coalesce(p_servings, me.household_size), me.id, null) l
    join public.ingredients i on i.id = l.ingredient_id
    where not l.is_optional
    group by r.id, l.ingredient_id, l.ingredient_name
  ),
  stocked as (
    select l.*, coalesce(st.grams, 0) as have_g, st.first_expiry
    from lines l cross join me
    left join lateral (
      select sum(pi.quantity_g) as grams, min(pi.expires_on) as first_expiry
      from public.pantry_items pi
      where pi.user_id = me.id and pi.ingredient_id = l.ingredient_id and pi.quantity_g > 0
        and (pi.expires_on is null or pi.expires_on >= current_date)
    ) st on true
  ),
  agg as (
    select s.recipe_id,
           count(*) as n,
           count(*) filter (where s.is_staple or s.have_g >= s.grams) as covered,
           jsonb_agg(jsonb_build_object('ingredient_id', s.ingredient_id, 'ingredient_name', s.ingredient_name,
                                        'missing_g', round(s.grams - s.have_g, 2)) order by s.ingredient_name)
             filter (where not s.is_staple and s.have_g < s.grams) as missing,
           bool_or(s.first_expiry <= current_date + 3) as uses_expiring
    from stocked s group by s.recipe_id
  )
  select r.id, r.title, r.total_minutes,
         round(a.covered::numeric / a.n, 2), (a.n - a.covered)::int,
         coalesce(a.missing, '[]'::jsonb), coalesce(a.uses_expiring, false)
  from rec r join agg a on a.recipe_id = r.id
  order by round(a.covered::numeric / a.n, 2) desc, coalesce(a.uses_expiring, false) desc,
           (a.n - a.covered), r.total_minutes, r.title
  limit least(greatest(coalesce(p_limit, 10), 1), 50)
$$;

-- ---- R9 · Guardar un plan generado en UNA transacción ------------------------
-- Reemplaza el borrador que cubra esas fechas (idempotente) y nunca toca un plan confirmado.
-- p_meals: [{meal_date, slot, recipe_id, servings?, reason_code?, reason_ingredient_id?,
--            choices?: [{group_key, ingredient_id}]}]
create function public.save_generated_plan(p_start date, p_end date, p_meals jsonb, p_budget_limit numeric default null)
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

-- ---- Exportación incluye las elecciones --------------------------------------
create or replace function public.export_my_data()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'exported_at', now(),
    'profile',        (select to_jsonb(t) from public.profiles t where t.id = v_user),
    'health',         (select to_jsonb(t) from public.profile_health t where t.user_id = v_user),
    'notification_preferences', (select to_jsonb(t) from public.notification_preferences t where t.user_id = v_user),
    'consents',       (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.user_consents t where t.user_id = v_user),
    'diets',          (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.user_diets t where t.user_id = v_user),
    'allergens',      (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.user_allergens t where t.user_id = v_user),
    'conditions',     (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.user_conditions t where t.user_id = v_user),
    'disliked_ingredients', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.user_disliked_ingredients t where t.user_id = v_user),
    'cuisines',       (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.user_cuisines t where t.user_id = v_user),
    'favorite_recipes', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.favorite_recipes t where t.user_id = v_user),
    'section_order',  (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.user_section_order t where t.user_id = v_user),
    'pantry',         (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.pantry_items t where t.user_id = v_user),
    'meal_plans',     (select coalesce(jsonb_agg(to_jsonb(p) || jsonb_build_object('meals',
                         (select coalesce(jsonb_agg(to_jsonb(pm) || jsonb_build_object('choices',
                            (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from public.planned_meal_choices c where c.planned_meal_id = pm.id))), '[]')
                          from public.planned_meals pm where pm.plan_id = p.id))), '[]')
                       from public.meal_plans p where p.user_id = v_user),
    'shopping_lists', (select coalesce(jsonb_agg(to_jsonb(l) || jsonb_build_object('items',
                         (select coalesce(jsonb_agg(to_jsonb(i)), '[]') from public.shopping_list_items i where i.list_id = l.id))), '[]')
                       from public.shopping_lists l where l.user_id = v_user),
    'purchases',      (select coalesce(jsonb_agg(to_jsonb(p) || jsonb_build_object('items',
                         (select coalesce(jsonb_agg(to_jsonb(i)), '[]') from public.purchase_items i where i.purchase_id = p.id))), '[]')
                       from public.purchases p where p.user_id = v_user),
    'ratings',        (select coalesce(jsonb_agg(to_jsonb(r) || jsonb_build_object('tags',
                         (select coalesce(jsonb_agg(l.tag_id), '[]') from public.recipe_rating_tag_links l where l.rating_id = r.id))), '[]')
                       from public.recipe_ratings r where r.user_id = v_user),
    'comments',       (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.recipe_comments t where t.user_id = v_user),
    'authored_recipes', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'status', t.status)), '[]')
                         from public.recipes t where t.author_id = v_user),
    'reports',        (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.content_reports t where t.reporter_id = v_user),
    'support_tickets', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.support_tickets t where t.user_id = v_user),
    'assistant_conversations', (select coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object('messages',
                         (select coalesce(jsonb_agg(to_jsonb(m) order by m.id), '[]') from public.assistant_messages m where m.conversation_id = c.id))), '[]')
                       from public.assistant_conversations c where c.user_id = v_user),
    'ai_usage',       (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.ai_generations t where t.user_id = v_user),
    'notifications',  (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.notifications t where t.user_id = v_user),
    'push_devices',   (select coalesce(jsonb_agg(to_jsonb(t) - 'expo_push_token'), '[]') from public.push_devices t where t.user_id = v_user)
  );
end $$;

-- ---- RLS y permisos de las tablas nuevas -------------------------------------
alter table public.recipe_flex_groups   enable row level security;
alter table public.recipe_flex_options  enable row level security;
alter table public.planned_meal_choices enable row level security;

do $$
declare t text;
begin
  foreach t in array array['recipe_flex_groups', 'recipe_flex_options']
  loop
    execute format('create policy %I on public.%I for select to authenticated
                      using (exists (select 1 from public.recipes r where r.id = recipe_id))', t || '_select', t);
    execute format('create policy %I on public.%I for all to authenticated
                      using (exists (select 1 from public.recipes r where r.id = recipe_id and r.author_id is null
                                     and ((select private.has_role(''nutritionist'')) or (select private.has_role(''admin'')))))
                      with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.author_id is null
                                     and ((select private.has_role(''nutritionist'')) or (select private.has_role(''admin'')))))',
                   t || '_staff_write', t);
    execute format('create policy %I on public.%I for all to authenticated
                      using (exists (select 1 from public.recipes r where r.id = recipe_id
                                     and r.author_id = (select auth.uid()) and r.status = ''draft''))
                      with check (exists (select 1 from public.recipes r where r.id = recipe_id
                                     and r.author_id = (select auth.uid()) and r.status = ''draft''))',
                   t || '_author_write', t);
  end loop;
end $$;

create policy planned_meal_choices_own on public.planned_meal_choices for all to authenticated
  using (exists (select 1 from public.planned_meals pm join public.meal_plans p on p.id = pm.plan_id
                 where pm.id = planned_meal_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.planned_meals pm join public.meal_plans p on p.id = pm.plan_id
                      where pm.id = planned_meal_id and p.user_id = (select auth.uid())));

revoke all on public.recipe_flex_groups, public.recipe_flex_options, public.planned_meal_choices from anon;
revoke truncate, references, trigger on public.recipe_flex_groups, public.recipe_flex_options, public.planned_meal_choices
  from authenticated;
grant select, insert, update, delete on public.recipe_flex_groups, public.recipe_flex_options, public.planned_meal_choices
  to authenticated;

revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated, service_role;
grant  select  on public.recipe_allergens, public.recipe_diets, public.recipe_nutrition, public.my_plan_conflicts to authenticated;
