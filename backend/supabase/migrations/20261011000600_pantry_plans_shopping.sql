-- =============================================================================
-- 0006 · Despensa, planes de comida, lista de compras y compras
-- =============================================================================

-- ---- Despensa: un lote = (usuario, ingrediente, fecha de vencimiento) -------
create table public.pantry_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id),
  quantity_g    numeric(10,2) not null check (quantity_g >= 0),
  expires_on    date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint pantry_batch_uq unique nulls not distinct (user_id, ingredient_id, expires_on)
);
create index pantry_items_expiring_idx on public.pantry_items (user_id, expires_on)
  where quantity_g > 0 and expires_on is not null;
create index pantry_items_ingredient_idx on public.pantry_items (ingredient_id);
create trigger pantry_items_updated_at before update on public.pantry_items
  for each row execute function private.set_updated_at();
comment on table public.pantry_items is
  'Cantidad canónica en gramos. Mismo ingrediente y misma fecha = mismo lote (la cantidad se suma). Fechas distintas = lotes distintos.';

-- ---- Planes -----------------------------------------------------------------
create table public.meal_plans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  start_date   date not null,
  end_date     date not null,
  status       public.plan_status not null default 'draft',
  budget_limit numeric(12,2) check (budget_limit > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (end_date >= start_date and end_date - start_date <= 13),
  -- un usuario no puede tener dos planes vigentes que cubran el mismo día
  constraint meal_plans_no_overlap exclude using gist
    (user_id with =, daterange(start_date, end_date, '[]') with &&) where (status <> 'archived')
);
create trigger meal_plans_updated_at before update on public.meal_plans
  for each row execute function private.set_updated_at();
comment on column public.meal_plans.budget_limit is
  'Instantánea del tope de gasto aplicable a ESTE plan, calculada al crearlo desde el perfil. Desnormalización intencional: el presupuesto del perfil puede cambiar y el historial no debe cambiar con él.';

create function private.set_plan_budget_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_amount numeric;
  v_period public.budget_period;
  v_days   integer := new.end_date - new.start_date + 1;
begin
  if new.budget_limit is null then
    select budget_amount, budget_period into v_amount, v_period
    from public.profiles where id = new.user_id;
    if v_amount is not null then
      new.budget_limit := round(v_amount * v_days / case v_period when 'week' then 7 else 30 end, 2);
    end if;
  end if;
  return new;
end $$;
create trigger meal_plans_budget_limit before insert on public.meal_plans
  for each row execute function private.set_plan_budget_limit();

create table public.planned_meals (
  id                   uuid primary key default gen_random_uuid(),
  plan_id              uuid not null references public.meal_plans(id) on delete cascade,
  meal_date            date not null,
  slot                 public.meal_slot not null,
  recipe_id            uuid not null references public.recipes(id),
  servings             numeric(5,2) not null check (servings > 0 and servings <= 48),
  status               public.meal_status not null default 'planned',
  cooked_at            timestamptz,
  reason_code          text references public.recommendation_reasons(code),
  reason_ingredient_id uuid references public.ingredients(id),
  replaced_recipe_id   uuid references public.recipes(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (plan_id, meal_date, slot),
  check ((status = 'cooked') = (cooked_at is not null)),
  check (reason_code is not null or reason_ingredient_id is null)
);
create index planned_meals_recipe_idx on public.planned_meals (recipe_id);
create index planned_meals_date_idx   on public.planned_meals (plan_id, meal_date);
create trigger planned_meals_updated_at before update on public.planned_meals
  for each row execute function private.set_updated_at();
comment on column public.planned_meals.replaced_recipe_id is 'Receta anterior cuando el usuario cambió la comida (historial del cambio).';

-- Garantía a nivel de BASE DE DATOS: ningún plan puede contener una receta con un alérgeno del dueño,
-- sin importar si el cambio vino de la app, del asistente de IA o de un script.
create function private.validate_planned_meal()
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

  if private.recipe_conflicts_with_user(new.recipe_id, v_plan.user_id) then
    raise exception 'allergen_conflict: la receta contiene un alérgeno que el usuario declaró' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger planned_meals_validate
  before insert or update of plan_id, meal_date, recipe_id on public.planned_meals
  for each row execute function private.validate_planned_meal();

-- Qué lotes de despensa se descontaron al cocinar (permite deshacer con exactitud).
create table public.meal_pantry_deductions (
  planned_meal_id uuid not null references public.planned_meals(id) on delete cascade,
  pantry_item_id  uuid not null references public.pantry_items(id)  on delete cascade,
  grams           numeric(10,2) not null check (grams > 0),
  primary key (planned_meal_id, pantry_item_id)
);
create index meal_pantry_deductions_item_idx on public.meal_pantry_deductions (pantry_item_id);

-- ---- Lista de compras -------------------------------------------------------
create table public.shopping_lists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  plan_id    uuid references public.meal_plans(id) on delete set null,
  name       text not null default 'Lista de compras' check (char_length(name) between 1 and 80),
  status     public.list_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index shopping_lists_plan_uq on public.shopping_lists (plan_id) where plan_id is not null;
create index shopping_lists_user_idx on public.shopping_lists (user_id);
create trigger shopping_lists_updated_at before update on public.shopping_lists
  for each row execute function private.set_updated_at();

create table public.shopping_list_items (
  id                uuid primary key default gen_random_uuid(),
  list_id           uuid not null references public.shopping_lists(id) on delete cascade,
  ingredient_id     uuid references public.ingredients(id),
  custom_name       text check (char_length(custom_name) between 1 and 80),
  store_category_id smallint references public.ingredient_categories(id),
  needed_g          numeric(10,2) check (needed_g > 0),
  pantry_g          numeric(10,2) not null default 0 check (pantry_g >= 0),
  to_buy_g          numeric(10,2) generated always as
                    (case when needed_g is null then null else greatest(needed_g - pantry_g, 0) end) stored,
  is_checked        boolean not null default false,
  checked_at        timestamptz,
  source            public.shopping_item_source not null default 'manual',
  created_at        timestamptz not null default now(),
  check ((ingredient_id is null) <> (custom_name is null)),
  check (source <> 'plan' or ingredient_id is not null),
  check (ingredient_id is null or store_category_id is null),   -- la sección de un ingrediente se deriva de él
  check (is_checked = (checked_at is not null)),
  unique (list_id, ingredient_id)
);
create index shopping_list_items_list_idx on public.shopping_list_items (list_id);
comment on column public.shopping_list_items.pantry_g is
  'Instantánea de lo que había en despensa al generar la lista. to_buy_g = max(necesario - despensa, 0) es una columna generada.';
comment on column public.shopping_list_items.store_category_id is 'Solo para ítems libres; en ítems de ingrediente la sección sale de ingredients.store_category_id.';

-- ---- Compras realizadas (gasto real vs. presupuesto; base para OCR de recibos) ----
create table public.purchases (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  shopping_list_id uuid references public.shopping_lists(id) on delete set null,
  purchased_on     date not null default current_date,
  store_name       text check (char_length(store_name) <= 80),
  total_amount     numeric(12,2) not null check (total_amount >= 0),
  created_at       timestamptz not null default now()
);
create index purchases_user_date_idx on public.purchases (user_id, purchased_on desc);
comment on column public.purchases.total_amount is
  'Total real pagado. NO se deriva de purchase_items: impuestos y líneas no reconocidas hacen que sean hechos independientes.';

create table public.purchase_items (
  id            uuid primary key default gen_random_uuid(),
  purchase_id   uuid not null references public.purchases(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id),
  raw_text      text,
  quantity_g    numeric(10,2) check (quantity_g > 0),
  line_amount   numeric(12,2) not null check (line_amount >= 0),
  check (ingredient_id is not null or raw_text is not null)   -- una línea no reconocida nunca se descarta en silencio
);
create index purchase_items_purchase_idx on public.purchase_items (purchase_id);

-- ---- Vistas del usuario -----------------------------------------------------
create view public.my_monthly_spend with (security_invoker = true) as
select p.user_id, date_trunc('month', p.purchased_on)::date as month,
       sum(p.total_amount) as spent, count(*)::int as purchases
from public.purchases p
group by p.user_id, date_trunc('month', p.purchased_on);

create view public.my_plan_conflicts with (security_invoker = true) as
select pm.id as planned_meal_id, pm.plan_id, pm.meal_date, pm.slot, pm.recipe_id
from public.planned_meals pm
join public.meal_plans p on p.id = pm.plan_id
where pm.status = 'planned'
  and pm.meal_date >= current_date
  and private.recipe_conflicts_with_user(pm.recipe_id, p.user_id);
comment on view public.my_plan_conflicts is 'Comidas futuras del plan que chocan con las alergias declaradas HOY (p. ej. alergia declarada después de planear).';
