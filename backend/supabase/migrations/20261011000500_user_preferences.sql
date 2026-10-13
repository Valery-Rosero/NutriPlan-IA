-- =============================================================================
-- 0005 · Preferencias del usuario y núcleo de seguridad alimentaria
-- Restricción DURA: alergias y dietas (nunca se negocian).
-- Restricción BLANDA: ingredientes que no le gustan, cocinas favoritas.
-- =============================================================================

create table public.user_diets (
  user_id uuid     not null references public.profiles(id) on delete cascade,
  diet_id smallint not null references public.diets(id),
  primary key (user_id, diet_id)
);
comment on table public.user_diets is '"Omnívoro" no es una fila: es la ausencia de dietas.';

create table public.user_allergens (
  user_id     uuid     not null references public.profiles(id) on delete cascade,
  allergen_id smallint not null references public.allergens(id),
  primary key (user_id, allergen_id)
);

create table public.user_conditions (
  user_id      uuid     not null references public.profiles(id) on delete cascade,
  condition_id smallint not null references public.medical_conditions(id),
  declared_at  timestamptz not null default now(),
  primary key (user_id, condition_id)
);

create table public.user_disliked_ingredients (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  primary key (user_id, ingredient_id)
);

create table public.user_cuisines (
  user_id    uuid     not null references public.profiles(id) on delete cascade,
  cuisine_id smallint not null references public.cuisines(id),
  primary key (user_id, cuisine_id)
);

create table public.favorite_recipes (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  recipe_id  uuid not null references public.recipes(id)  on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);
create index favorite_recipes_recipe_idx on public.favorite_recipes (recipe_id);

-- Orden personal de secciones del supermercado para la lista de compras.
create table public.user_section_order (
  user_id           uuid     not null references public.profiles(id) on delete cascade,
  store_category_id smallint not null references public.ingredient_categories(id),
  position          smallint not null check (position > 0),
  primary key (user_id, store_category_id)
);

-- Índices de FK que las consultas de filtrado usan
create index user_allergens_allergen_idx on public.user_allergens (allergen_id);
create index user_diets_diet_idx         on public.user_diets (diet_id);

-- ============================ NÚCLEO DE SEGURIDAD ============================
-- SECURITY DEFINER a propósito: la decisión de seguridad no debe depender de qué filas
-- deja ver RLS al llamador. Solo devuelve un booleano, no expone datos.

-- ¿La receta contiene algún alérgeno que el usuario declaró? (incluye ingredientes opcionales)
create function private.recipe_conflicts_with_user(p_recipe_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.recipe_ingredients ri
    join public.ingredient_allergens ia on ia.ingredient_id = ri.ingredient_id
    join public.user_allergens ua       on ua.allergen_id   = ia.allergen_id
    where ri.recipe_id = p_recipe_id and ua.user_id = p_user_id
  )
$$;

-- ¿El ingrediente es inaceptable para el usuario por alergia o por una dieta basada en reglas?
create function private.ingredient_blocked_for_user(p_ingredient_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
           select 1 from public.ingredient_allergens ia
           join public.user_allergens ua on ua.allergen_id = ia.allergen_id
           where ia.ingredient_id = p_ingredient_id and ua.user_id = p_user_id)
      or exists (
           select 1
           from public.user_diets ud
           join public.diets d on d.id = ud.diet_id and d.kind = 'rule_based'
           join public.ingredients i on i.id = p_ingredient_id
           where ud.user_id = p_user_id
             and ( exists (select 1 from public.diet_excluded_food_groups x
                            where x.diet_id = d.id and x.food_group_id = i.food_group_id)
                or exists (select 1 from public.ingredient_allergens ia2
                            join public.diet_excluded_allergens xa on xa.allergen_id = ia2.allergen_id
                            where ia2.ingredient_id = i.id and xa.diet_id = d.id)))
$$;

-- Declarar una condición médica exige haber aceptado el aviso de salud.
create function private.require_health_disclaimer()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not private.has_consent(new.user_id, 'health_disclaimer') then
    raise exception 'health_disclaimer_required: acepta el aviso de salud antes de declarar una condición médica'
      using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger user_conditions_disclaimer before insert on public.user_conditions
  for each row execute function private.require_health_disclaimer();

-- Si el usuario declara una alergia nueva, las recetas favoritas que la contienen salen de favoritos.
create function private.purge_favorites_on_new_allergen()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.favorite_recipes f
  where f.user_id = new.user_id
    and exists (
      select 1 from public.recipe_ingredients ri
      join public.ingredient_allergens ia on ia.ingredient_id = ri.ingredient_id
      where ri.recipe_id = f.recipe_id and ia.allergen_id = new.allergen_id);
  return new;
end $$;
create trigger user_allergens_purge_favorites after insert on public.user_allergens
  for each row execute function private.purge_favorites_on_new_allergen();
