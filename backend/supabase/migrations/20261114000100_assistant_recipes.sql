-- ADR-029: el asistente crea sus propias recetas con lo que hay en la cocina (y lo que haga falta comprar),
-- y propone hasta tres opciones por respuesta.
--
-- Seguridad (ADR-003, "el LLM propone, la BD dispone"):
--   * La IA solo usa ingredientes del CATÁLOGO, por id: de ellos la base conoce alérgenos, dietas y nutrición.
--   * create_assistant_recipe valida todo aquí (alergias y dietas de la persona, tiempo máximo, cantidades,
--     pasos) y guarda la receta como BORRADOR PRIVADO de la persona (las políticas existentes ya ocultan los
--     borradores a los demás). Nunca entra al plan automático ni a eligible_recipes.
--   * La nutrición se calcula con el catálogo (preview_recipe), nunca la inventa la IA.
--   * Lo único que se abre: la DUEÑA puede cocinar o poner en su plan su propia receta del asistente; los
--     mismos chequeos de alérgenos y dieta del trigger siguen corriendo.

-- ---- Marca --------------------------------------------------------------------------------------------
alter table public.recipes add column created_by_assistant boolean not null default false;
comment on column public.recipes.created_by_assistant is
  'Receta creada por el asistente (ADR-029): borrador privado de su autora, solo con ingredientes del catálogo y validada por create_assistant_recipe. Nunca se publica.';
alter table public.recipes add constraint recipes_assistant_stays_draft
  check (not created_by_assistant or status = 'draft');
create index recipes_assistant_author_idx on public.recipes (author_id, created_at) where created_by_assistant;

-- ---- Ingredientes que la IA puede usar ------------------------------------------------------------------
-- Del catálogo, con nutrición y alérgenos revisados, y SIN lo que la persona no puede comer. Se le dice cuáles
-- tiene en su cocina y cuáles vencen pronto. No expone alergias ni dietas: solo deja fuera lo bloqueado.
create function public.assistant_ingredients()
returns table (ingredient_id uuid, name text, in_pantry boolean, expiring boolean, is_staple boolean)
language sql stable set search_path = '' as $$
  select i.id, i.name,
         private.in_pantry((select auth.uid()), i.id) or i.is_staple,
         exists (select 1 from public.pantry_items pi
                 where pi.user_id = (select auth.uid()) and pi.ingredient_id = i.id and pi.quantity_g > 0
                   and pi.expires_on between current_date and current_date + 3),
         i.is_staple
  from public.ingredients i
  where (select auth.uid()) is not null
    and i.allergens_reviewed_at is not null
    and exists (select 1 from public.ingredient_nutrition n where n.ingredient_id = i.id)
    and not private.ingredient_blocked_for_user(i.id, (select auth.uid()))
  order by i.name
$$;
revoke all on function public.assistant_ingredients() from public, anon;
grant execute on function public.assistant_ingredients() to authenticated;

-- ---- Crear y validar una receta del asistente -----------------------------------------------------------
-- p_recipe: { title, description?, slot, servings, prep_minutes, cook_minutes,
--             ingredients: [{ ingredient_id, grams }], steps: [texto] }
create function public.create_assistant_recipe(p_recipe jsonb)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user     uuid := (select auth.uid());
  v_id       uuid;
  v_title    text := btrim(coalesce(p_recipe ->> 'title', ''));
  v_desc     text := nullif(btrim(coalesce(p_recipe ->> 'description', '')), '');
  v_slot     public.meal_slot;
  v_servings integer;
  v_prep     integer;
  v_cook     integer;
  v_max      integer;
  v_ings     jsonb := coalesce(p_recipe -> 'ingredients', '[]'::jsonb);
  v_steps    jsonb := coalesce(p_recipe -> 'steps', '[]'::jsonb);
  v_gram     smallint := (select id from public.units where code = 'g');
  v_bad      text;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  -- Tope propio de la base (la función se puede llamar directo con el JWT, no solo desde el asistente).
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
  -- El tiempo máximo de la persona (US-137) también aplica a lo que inventa el asistente.
  select p.max_cook_minutes into v_max from public.profiles p where p.id = v_user;
  if v_max is not null and v_prep + v_cook > v_max then
    raise exception 'too_long: la receta pasa tu tiempo máximo' using errcode = 'P0001';
  end if;

  if jsonb_typeof(v_ings) <> 'array' or jsonb_array_length(v_ings) not between 1 and 15 then
    raise exception 'invalid_recipe: entre 1 y 15 ingredientes' using errcode = '22023';
  end if;
  if jsonb_typeof(v_steps) <> 'array' or jsonb_array_length(v_steps) not between 1 and 12 then
    raise exception 'invalid_recipe: entre 1 y 12 pasos' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v_steps) s
             where jsonb_typeof(s) <> 'string' or char_length(btrim(s #>> '{}')) not between 3 and 400) then
    raise exception 'invalid_recipe: cada paso entre 3 y 400 caracteres' using errcode = '22023';
  end if;

  -- Cada ingrediente: id del catálogo, sin repetir, gramos razonables, con ficha completa.
  begin
    perform 1 from jsonb_array_elements(v_ings) x
    where (x ->> 'ingredient_id')::uuid is null or (x ->> 'grams')::numeric is null;
  exception when others then
    raise exception 'invalid_recipe: ingrediente mal formado' using errcode = '22023';
  end;
  if exists (select 1 from jsonb_array_elements(v_ings) x
             where (x ->> 'ingredient_id') is null or (x ->> 'grams') is null
                or (x ->> 'grams')::numeric not between 1 and 3000) then
    raise exception 'invalid_recipe: cantidad de un ingrediente fuera de rango' using errcode = '22023';
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
  insert into public.recipe_steps (recipe_id, step_number, instruction)
  select v_id, o::smallint, btrim(s #>> '{}') from jsonb_array_elements(v_steps) with ordinality as t(s, o);
  return v_id;
end $$;
revoke all on function public.create_assistant_recipe(jsonb) from public, anon;
grant execute on function public.create_assistant_recipe(jsonb) to authenticated;

-- ¿La persona puede usar esta receta del asistente en este momento del día? (suya, segura, a tiempo)
create function private.assistant_recipe_ok(p_recipe_id uuid, p_user_id uuid, p_slot public.meal_slot)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.recipes r
    join public.profiles p on p.id = p_user_id
    where r.id = p_recipe_id and r.created_by_assistant and r.author_id = p_user_id
      and exists (select 1 from public.recipe_meal_slots s where s.recipe_id = r.id and s.slot = p_slot)
      and r.total_minutes <= coalesce(p.max_cook_minutes, 32767)
      and not private.recipe_blocked_for_user(r.id, p_user_id))
$$;

-- ---- Cocinar o planear la propia receta del asistente ------------------------------------------------
-- Copia exacta de 20261013000200_flexible_recipes.sql + la excepción marcada.
create or replace function private.validate_planned_meal()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_plan   record;
  v_recipe record;
begin
  select user_id, start_date, end_date into v_plan from public.meal_plans where id = new.plan_id;
  if not found then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if new.meal_date < v_plan.start_date or new.meal_date > v_plan.end_date then
    raise exception 'meal_date_out_of_plan: la fecha queda fuera del rango del plan' using errcode = '22023';
  end if;
  select status, created_by_assistant, author_id into v_recipe from public.recipes where id = new.recipe_id;
  -- ADR-029: además de las publicadas, la autora puede usar SU receta del asistente (nadie más).
  if v_recipe.status is distinct from 'published'
     and not (coalesce(v_recipe.created_by_assistant, false) and v_recipe.author_id = v_plan.user_id) then
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

-- ---- Varias sugerencias por mensaje ---------------------------------------------------------------------
create table public.assistant_message_suggestions (
  message_id bigint   not null references public.assistant_messages (id) on delete cascade,
  position   smallint not null check (position between 1 and 3),
  recipe_id  uuid     not null references public.recipes (id) on delete cascade,
  primary key (message_id, recipe_id),
  unique (message_id, position)
);
comment on table public.assistant_message_suggestions is
  'Hasta tres recetas que propuso el asistente en un mensaje (ADR-029): del recetario o creadas por él. Las escribe solo la Edge Function.';
alter table public.assistant_message_suggestions enable row level security;
create policy assistant_message_suggestions_own on public.assistant_message_suggestions for select to authenticated
  using (exists (select 1 from public.assistant_messages m join public.assistant_conversations c on c.id = m.conversation_id
                 where m.id = message_id and c.user_id = (select auth.uid())));
revoke all on public.assistant_message_suggestions from anon;
grant select on public.assistant_message_suggestions to authenticated;

-- Aplicar UNA de las sugerencias a la comida destino. Copia de 20261013000100_hardening.sql + elegir cuál.
drop function public.apply_assistant_suggestion(bigint);
create function public.apply_assistant_suggestion(p_message_id bigint, p_recipe_id uuid default null)
returns uuid
language plpgsql set search_path = '' as $$
declare
  v_user   uuid := (select auth.uid());
  v_msg    public.assistant_messages;
  v_slot   public.meal_slot;
  v_recipe uuid;
begin
  select m.* into v_msg
  from public.assistant_messages m join public.assistant_conversations c on c.id = m.conversation_id
  where m.id = p_message_id and c.user_id = v_user
  for update of m;
  if not found then
    raise exception 'message_not_found' using errcode = 'P0002';
  end if;
  if v_msg.role <> 'assistant' or v_msg.suggested_recipe_id is null or v_msg.target_planned_meal_id is null then
    raise exception 'no_suggestion: el mensaje no contiene una sugerencia aplicable' using errcode = 'P0001';
  end if;
  if v_msg.applied_at is not null then
    raise exception 'already_applied' using errcode = 'P0001';
  end if;
  v_recipe := coalesce(p_recipe_id, v_msg.suggested_recipe_id);
  if v_recipe <> v_msg.suggested_recipe_id
     and not exists (select 1 from public.assistant_message_suggestions s where s.message_id = p_message_id and s.recipe_id = v_recipe) then
    raise exception 'no_suggestion: esa receta no la propuso este mensaje' using errcode = 'P0001';
  end if;

  select pm.slot into v_slot from public.planned_meals pm
  where pm.id = v_msg.target_planned_meal_id and pm.status = 'planned';
  if not found then
    raise exception 'meal_not_found: la comida destino ya no se puede cambiar' using errcode = 'P0002';
  end if;
  -- Del recetario: el mismo conjunto seguro del plan. Del asistente: suya, segura y a tiempo.
  if not exists (select 1 from public.eligible_recipes(v_slot) e where e.id = v_recipe)
     and not private.assistant_recipe_ok(v_recipe, v_user, v_slot) then
    raise exception 'not_eligible: la receta sugerida no cumple tus restricciones' using errcode = 'P0001';
  end if;

  update public.planned_meals
     set replaced_recipe_id = recipe_id,
         recipe_id = v_recipe,
         reason_code = 'user_request',
         reason_ingredient_id = null
   where id = v_msg.target_planned_meal_id;

  update public.assistant_messages set applied_at = now() where id = p_message_id;
  return v_msg.target_planned_meal_id;
end $$;
revoke all on function public.apply_assistant_suggestion(bigint, uuid) from public, anon;
grant execute on function public.apply_assistant_suggestion(bigint, uuid) to authenticated;

-- ---- Al borrar la cuenta, sus recetas del asistente se van con ella --------------------------------------
-- author_id pasa a null por la FK y sus planes y conversaciones se borran en cascada; por eso la limpieza es
-- DIFERIDA (corre al confirmar, cuando ya terminaron todas las cascadas). Una por una: si alguna siguiera
-- referenciada, se queda anónima en vez de impedir el borrado de la cuenta.
create function private.purge_orphan_assistant_recipes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r uuid;
begin
  for r in select id from public.recipes where created_by_assistant and author_id is null loop
    begin
      delete from public.recipes where id = r;
    exception when foreign_key_violation then
      null;
    end;
  end loop;
  return null;
end $$;
create constraint trigger profiles_purge_assistant_recipes after delete on public.profiles
  deferrable initially deferred
  for each row execute function private.purge_orphan_assistant_recipes();
