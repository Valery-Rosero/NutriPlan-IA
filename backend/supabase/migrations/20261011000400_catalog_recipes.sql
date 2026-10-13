-- =============================================================================
-- 0004 · Catálogo: ingredientes, nutrición, recetas, precios
-- Principio rector: lo que se puede DERIVAR no se guarda. Alérgenos y dietas de una
-- receta salen de sus ingredientes; así no existen etiquetas que puedan quedar viejas.
-- =============================================================================

-- ---- Ingredientes -----------------------------------------------------------
create table public.ingredients (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (char_length(name) between 2 and 80),
  food_group_id       smallint not null references public.food_groups(id),
  store_category_id   smallint not null references public.ingredient_categories(id),
  density_g_per_ml    numeric(6,3) not null default 1.000 check (density_g_per_ml > 0),
  heat_level          smallint not null default 0 check (heat_level between 0 and 3),
  shelf_life_days     smallint check (shelf_life_days > 0),
  rounding_step       numeric(6,3) check (rounding_step > 0),
  created_at          timestamptz not null default now()
);
create unique index ingredients_name_uq   on public.ingredients (lower(name));
create index ingredients_food_group_idx   on public.ingredients (food_group_id);
create index ingredients_category_idx     on public.ingredients (store_category_id);
create index ingredients_name_trgm_idx    on public.ingredients
  using gin (private.f_unaccent(lower(name)) extensions.gin_trgm_ops);
comment on column public.ingredients.density_g_per_ml is 'Para pasar volumen a gramos (taza de harina ≈ 0.5). Por defecto 1.0 (agua).';
comment on column public.ingredients.heat_level is '0 sin picante ... 3 picante. El picante de una receta se deriva del máximo de sus ingredientes.';
comment on column public.ingredients.rounding_step is 'Sobrescribe units.rounding_step (ej. huevos: 1, nunca 0.5).';

-- Peso de una unidad "contable" por ingrediente (1 diente de ajo = 5 g). Depende de la PAREJA (ingrediente, unidad).
create table public.ingredient_unit_weights (
  ingredient_id  uuid     not null references public.ingredients(id) on delete cascade,
  unit_id        smallint not null,
  unit_dimension public.units_dimension not null default 'count' check (unit_dimension = 'count'),
  grams          numeric(8,2) not null check (grams > 0),
  primary key (ingredient_id, unit_id),
  foreign key (unit_id, unit_dimension) references public.units (id, dimension)
);
comment on column public.ingredient_unit_weights.unit_dimension is
  'Columna constante: junto con la FK compuesta garantiza que solo se registren pesos para unidades de tipo count.';

create table public.ingredient_nutrition (
  ingredient_id uuid primary key references public.ingredients(id) on delete cascade,
  kcal          numeric(7,2) not null check (kcal >= 0),
  protein_g     numeric(6,2) not null check (protein_g >= 0),
  carbs_g       numeric(6,2) not null check (carbs_g >= 0),
  fat_g         numeric(6,2) not null check (fat_g >= 0),
  fiber_g       numeric(6,2) not null check (fiber_g >= 0),
  sugar_g       numeric(6,2) not null check (sugar_g >= 0),
  sodium_mg     numeric(8,2) not null check (sodium_mg >= 0),
  source        text not null,
  reference_url text,
  verified_at   date,
  check (protein_g + carbs_g + fat_g <= 100.5),   -- por 100 g no puede haber más de 100 g de macros
  check (sugar_g <= carbs_g and fiber_g <= carbs_g)
);
comment on table public.ingredient_nutrition is 'Valores por 100 g. Separada de ingredients: es un dato con fuente y fecha de verificación propias.';

create table public.ingredient_allergens (
  ingredient_id uuid     not null references public.ingredients(id) on delete cascade,
  allergen_id   smallint not null references public.allergens(id)   on delete cascade,
  primary key (ingredient_id, allergen_id)
);
create index ingredient_allergens_allergen_idx on public.ingredient_allergens (allergen_id);

create table public.ingredient_substitutions (
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  substitute_id uuid not null references public.ingredients(id) on delete cascade,
  ratio         numeric(6,3) not null default 1 check (ratio > 0),
  note          text,
  primary key (ingredient_id, substitute_id),
  check (ingredient_id <> substitute_id)
);
comment on table public.ingredient_substitutions is
  'Sustitutos candidatos. Qué sustitutos sirven a cada usuario se decide al consultar (suggest_substitutes), según sus alérgenos y dietas.';

-- ---- Precios ----------------------------------------------------------------
create table public.price_sources (
  id            smallint generated always as identity primary key,
  name          text not null unique,
  url           text,
  license_notes text
);

create table public.ingredient_prices (
  id            bigint generated always as identity primary key,
  ingredient_id uuid     not null references public.ingredients(id) on delete cascade,
  region_id     smallint not null references public.regions(id),
  price_per_kg  numeric(12,2) not null check (price_per_kg > 0),
  source_id     smallint not null references public.price_sources(id),
  observed_on   date not null,
  unique (ingredient_id, region_id, source_id, observed_on)
);
create index ingredient_prices_lookup_idx on public.ingredient_prices (ingredient_id, region_id, observed_on desc);
comment on table public.ingredient_prices is 'Historial de precios por kg (unidad canónica). La moneda sale de region > country. Moneda y vigencia no se repiten por fila.';

-- ---- Recetas ----------------------------------------------------------------
create table public.recipes (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid references public.profiles(id) on delete set null,   -- null = receta oficial
  title           text not null check (char_length(title) between 3 and 120),
  description     text,
  cuisine_id      smallint references public.cuisines(id),
  main_protein_id smallint references public.protein_sources(id),
  base_servings   smallint not null check (base_servings between 1 and 24),
  prep_minutes    smallint not null check (prep_minutes >= 0),
  cook_minutes    smallint not null default 0 check (cook_minutes >= 0),
  total_minutes   smallint generated always as (prep_minutes + cook_minutes) stored,
  difficulty      smallint not null default 1 check (difficulty between 1 and 3),
  keeps_days      smallint check (keeps_days > 0),
  storage_notes   text,
  status          public.recipe_status not null default 'draft',
  published_at    timestamptz,
  image_path      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  search_tsv      tsvector generated always as
                  (to_tsvector('spanish', title || ' ' || coalesce(description, ''))) stored,
  check ((keeps_days is null) = (storage_notes is null)),
  check (status <> 'published' or published_at is not null)
);
create index recipes_status_idx   on public.recipes (status);
create index recipes_author_idx   on public.recipes (author_id) where author_id is not null;
create index recipes_cuisine_idx  on public.recipes (cuisine_id);
create index recipes_protein_idx  on public.recipes (main_protein_id);
create index recipes_search_idx   on public.recipes using gin (search_tsv);
create index recipes_title_trgm   on public.recipes using gin (private.f_unaccent(lower(title)) extensions.gin_trgm_ops);
create trigger recipes_updated_at before update on public.recipes
  for each row execute function private.set_updated_at();
comment on column public.recipes.keeps_days is
  'Días de conservación. "Apta para batch cooking" no se guarda: se deriva (base_servings >= 4 y keeps_days no nulo).';
comment on column public.recipes.author_id is 'Al borrar la cuenta del autor la receta se anonimiza (SET NULL), no se pierde.';

create table public.recipe_meal_slots (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  slot      public.meal_slot not null,
  primary key (recipe_id, slot)
);

create table public.recipe_ingredients (
  recipe_id        uuid     not null references public.recipes(id) on delete cascade,
  ingredient_id    uuid     not null references public.ingredients(id),
  quantity         numeric(10,3) not null check (quantity > 0),
  unit_id          smallint not null references public.units(id),
  is_optional      boolean  not null default false,
  scaling_exponent numeric(3,2) not null default 1.00 check (scaling_exponent between 0 and 1),
  notes            text,
  sort_order       smallint not null default 0,
  primary key (recipe_id, ingredient_id)
);
create index recipe_ingredients_ingredient_idx on public.recipe_ingredients (ingredient_id);
comment on column public.recipe_ingredients.scaling_exponent is
  'Cantidad escalada = base × (porciones/porciones_base)^exponente. 1 lineal; ~0.7 especias; 0 fija (una hoja de laurel).';

create table public.recipe_steps (
  recipe_id     uuid     not null references public.recipes(id) on delete cascade,
  step_number   smallint not null check (step_number > 0),
  instruction   text     not null,
  timer_seconds integer  check (timer_seconds > 0),
  primary key (recipe_id, step_number)
);

-- Solo dietas "curated" se etiquetan a mano; las rule_based se derivan (vista recipe_diets).
create table public.recipe_diet_tags (
  recipe_id uuid     not null references public.recipes(id) on delete cascade,
  diet_id   smallint not null,
  diet_kind public.diet_kind not null default 'curated' check (diet_kind = 'curated'),
  primary key (recipe_id, diet_id),
  foreign key (diet_id, diet_kind) references public.diets (id, kind)
);

create table public.nutritionist_reviews (
  id               uuid primary key default gen_random_uuid(),
  recipe_id        uuid not null references public.recipes(id) on delete cascade,
  reviewer_id      uuid references public.profiles(id) on delete set null,
  reviewer_name    text not null,
  reviewer_license text,
  outcome          public.review_outcome not null,
  notes            text,
  reviewed_at      timestamptz not null default now()
);
create index nutritionist_reviews_recipe_idx on public.nutritionist_reviews (recipe_id, reviewed_at desc);
comment on column public.nutritionist_reviews.reviewer_name is
  'Copia intencional del nombre: el registro de quién revisó debe sobrevivir si la cuenta del revisor se elimina.';

-- ============================ CONVERSIÓN DE UNIDADES =========================
-- Todo se normaliza a gramos. masa: directo · volumen: ml × densidad · contable: peso de la pareja (ingrediente, unidad).
create function private.to_grams(p_ingredient_id uuid, p_quantity numeric, p_unit_id smallint)
returns numeric language plpgsql stable set search_path = '' as $$
declare
  v_dim    public.units_dimension;
  v_factor numeric;
  v_dens   numeric;
  v_weight numeric;
begin
  select dimension, factor into v_dim, v_factor from public.units where id = p_unit_id;
  if not found then
    raise exception 'unit_not_found' using errcode = 'P0002';
  end if;

  if v_dim = 'mass' then
    return p_quantity * v_factor;
  elsif v_dim = 'volume' then
    select density_g_per_ml into v_dens from public.ingredients where id = p_ingredient_id;
    if v_dens is null then raise exception 'ingredient_not_found' using errcode = 'P0002'; end if;
    return p_quantity * v_factor * v_dens;
  else
    select grams into v_weight from public.ingredient_unit_weights
     where ingredient_id = p_ingredient_id and unit_id = p_unit_id;
    if v_weight is null then
      raise exception 'unit_incompatible: no hay equivalencia en gramos para este ingrediente y esta unidad'
        using errcode = '22023';
    end if;
    return p_quantity * v_weight;
  end if;
end $$;

-- Una línea de receta solo es válida si se puede convertir a gramos (nutrición, costo y compras dependen de eso).
create function private.check_recipe_ingredient_convertible()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform private.to_grams(new.ingredient_id, new.quantity, new.unit_id);
  return new;
end $$;
create trigger recipe_ingredients_convertible
  before insert or update of ingredient_id, quantity, unit_id on public.recipe_ingredients
  for each row execute function private.check_recipe_ingredient_convertible();

-- ============================ REGLAS DE PUBLICACIÓN ==========================
create function private.enforce_recipe_publishable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.recipe_ingredients where recipe_id = new.id) then
    raise exception 'recipe_incomplete: la receta no tiene ingredientes' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.recipe_steps where recipe_id = new.id) then
    raise exception 'recipe_incomplete: la receta no tiene pasos' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.recipe_ingredients ri
    left join public.ingredient_nutrition n on n.ingredient_id = ri.ingredient_id
    where ri.recipe_id = new.id and n.ingredient_id is null
  ) then
    raise exception 'recipe_missing_nutrition: hay ingredientes sin datos nutricionales' using errcode = 'P0001';
  end if;

  if new.author_id is null then
    -- receta oficial: la ÚLTIMA revisión nutricional debe ser aprobatoria
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

create trigger recipes_publish_on_insert before insert on public.recipes
  for each row when (new.status = 'published') execute function private.enforce_recipe_publishable();
create trigger recipes_publish_on_update before update of status on public.recipes
  for each row when (new.status = 'published' and old.status is distinct from 'published')
  execute function private.enforce_recipe_publishable();

-- Una receta publicada fue revisada con ESOS ingredientes: para tocarlos hay que despublicarla.
create function private.block_published_recipe_edits()
returns trigger language plpgsql set search_path = '' as $$
declare v_recipe uuid;
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 then return old; end if;      -- permite el borrado en cascada de la receta
    v_recipe := old.recipe_id;
  else
    v_recipe := new.recipe_id;
  end if;
  if exists (select 1 from public.recipes where id = v_recipe and status = 'published') then
    raise exception 'recipe_published_locked: pasa la receta a borrador antes de cambiar sus ingredientes'
      using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger recipe_ingredients_locked
  before insert or update or delete on public.recipe_ingredients
  for each row execute function private.block_published_recipe_edits();

-- ============================ VISTAS DERIVADAS ===============================
-- security_invoker: respetan RLS del usuario que consulta.

create view public.recipe_allergens with (security_invoker = true) as
select distinct ri.recipe_id, ia.allergen_id
from public.recipe_ingredients ri
join public.ingredient_allergens ia on ia.ingredient_id = ri.ingredient_id;
comment on view public.recipe_allergens is 'Alérgenos de una receta, derivados de TODOS sus ingredientes (incluidos los opcionales: la seguridad no admite excepciones).';

create view public.recipe_diets with (security_invoker = true) as
select r.id as recipe_id, d.id as diet_id
from public.recipes r
cross join public.diets d
where (d.kind = 'rule_based' and not exists (
         select 1
         from public.recipe_ingredients ri
         join public.ingredients i on i.id = ri.ingredient_id
         where ri.recipe_id = r.id
           and ( exists (select 1 from public.diet_excluded_food_groups x
                          where x.diet_id = d.id and x.food_group_id = i.food_group_id)
              or exists (select 1 from public.ingredient_allergens ia
                          join public.diet_excluded_allergens xa on xa.allergen_id = ia.allergen_id
                          where ia.ingredient_id = i.id and xa.diet_id = d.id)))
       )
   or (d.kind = 'curated' and exists (
         select 1 from public.recipe_diet_tags t where t.recipe_id = r.id and t.diet_id = d.id));
comment on view public.recipe_diets is 'Dietas compatibles: derivadas de ingredientes (rule_based) o etiquetadas por nutricionista (curated).';

create view public.recipe_max_heat with (security_invoker = true) as
select ri.recipe_id, max(i.heat_level)::smallint as heat_level
from public.recipe_ingredients ri
join public.ingredients i on i.id = ri.ingredient_id
where not ri.is_optional
group by ri.recipe_id;

create view public.recipe_nutrition with (security_invoker = true) as
select r.id as recipe_id,
       round(sum(g.grams / 100 * n.kcal)      / r.base_servings, 1) as kcal_per_serving,
       round(sum(g.grams / 100 * n.protein_g) / r.base_servings, 1) as protein_g_per_serving,
       round(sum(g.grams / 100 * n.carbs_g)   / r.base_servings, 1) as carbs_g_per_serving,
       round(sum(g.grams / 100 * n.fat_g)     / r.base_servings, 1) as fat_g_per_serving,
       round(sum(g.grams / 100 * n.fiber_g)   / r.base_servings, 1) as fiber_g_per_serving,
       round(sum(g.grams / 100 * n.sugar_g)   / r.base_servings, 1) as sugar_g_per_serving,
       round(sum(g.grams / 100 * n.sodium_mg) / r.base_servings, 0) as sodium_mg_per_serving,
       (count(*) filter (where n.ingredient_id is null))::int       as ingredients_missing_nutrition
from public.recipes r
join public.recipe_ingredients ri on ri.recipe_id = r.id and not ri.is_optional
cross join lateral (select private.to_grams(ri.ingredient_id, ri.quantity, ri.unit_id) as grams) g
left join public.ingredient_nutrition n on n.ingredient_id = ri.ingredient_id
group by r.id, r.base_servings;
comment on view public.recipe_nutrition is 'Nutrición por porción a las porciones base, calculada desde los ingredientes. Nunca se captura a mano.';

-- ============================ FUNCIONES DE CATÁLOGO ==========================
-- Escalado: cantidad = base × (porciones/base)^exponente, redondeada al paso de la unidad (o del ingrediente).
create function public.scale_recipe(p_recipe_id uuid, p_servings numeric)
returns table (ingredient_id uuid, ingredient_name text, is_optional boolean,
               quantity numeric, unit_id smallint, unit_code text, grams numeric)
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
  select ri.ingredient_id, i.name, ri.is_optional, q.qty, ri.unit_id, u.code,
         round(private.to_grams(ri.ingredient_id, q.qty, ri.unit_id), 2)
  from public.recipe_ingredients ri
  join public.ingredients i on i.id = ri.ingredient_id
  join public.units u       on u.id = ri.unit_id
  cross join lateral (select coalesce(i.rounding_step, u.rounding_step) as s) st
  cross join lateral (
    select greatest(st.s, round(ri.quantity * power(p_servings / v_base, ri.scaling_exponent) / st.s) * st.s) as qty
  ) q
  where ri.recipe_id = p_recipe_id
  order by ri.sort_order, i.name;
end $$;

-- Precio vigente de un ingrediente: el de la región o, si no hay, el del ancestro más cercano (marcado como estimado).
create function private.ingredient_price(p_ingredient_id uuid, p_region_id smallint)
returns table (price_per_kg numeric, price_region_id smallint, observed_on date, is_estimated boolean)
language sql stable set search_path = '' as $$
  with recursive chain as (
    select rg.id, rg.parent_id, 0 as depth from public.regions rg where rg.id = p_region_id
    union all
    select rg.id, rg.parent_id, c.depth + 1 from public.regions rg join chain c on rg.id = c.parent_id
  )
  select p.price_per_kg, p.region_id, p.observed_on, (c.depth > 0)
  from public.ingredient_prices p
  join chain c on c.id = p.region_id
  where p.ingredient_id = p_ingredient_id
  order by c.depth, p.observed_on desc, p.id desc
  limit 1
$$;

create function public.recipe_cost(p_recipe_id uuid, p_region_id smallint, p_servings numeric default null)
returns table (cost numeric, currency_code char(3), missing_prices integer, estimated_prices integer)
language sql stable set search_path = '' as $$
  with lines as (
    select s.ingredient_id, s.grams
    from public.scale_recipe(
           p_recipe_id,
           coalesce(p_servings, (select r.base_servings from public.recipes r where r.id = p_recipe_id))) s
    where not s.is_optional
  ),
  priced as (
    select l.grams, p.price_per_kg, p.is_estimated
    from lines l
    left join lateral private.ingredient_price(l.ingredient_id, p_region_id) p on true
  )
  select round(coalesce(sum(grams / 1000 * price_per_kg), 0), 2),
         (select c.currency_code from public.regions rg
            join public.countries c on c.code = rg.country_code where rg.id = p_region_id),
         (count(*) filter (where price_per_kg is null))::int,
         (count(*) filter (where is_estimated))::int
  from priced
$$;

create function public.search_ingredients(p_query text, p_limit integer default 20)
returns setof public.ingredients
language sql stable set search_path = '' as $$
  with q as (select private.f_unaccent(lower(trim(p_query))) as t)
  select i.*
  from public.ingredients i, q
  where char_length(q.t) >= 2
    and ( private.f_unaccent(lower(i.name)) like '%' || replace(replace(q.t, '%', '\%'), '_', '\_') || '%'
       or private.f_unaccent(lower(i.name)) operator(extensions.%) q.t )
  order by (private.f_unaccent(lower(i.name)) like replace(replace(q.t, '%', '\%'), '_', '\_') || '%') desc,
           extensions.similarity(private.f_unaccent(lower(i.name)), q.t) desc,
           i.name
  limit least(greatest(p_limit, 1), 50)
$$;
