-- US-187 · Alergias propias y lista revisada (ADR-041).
-- 1) La lista sigue los alérgenos que en Colombia se declaran en la etiqueta (Codex): "Soya" y "Sulfitos".
-- 2) La persona puede escribir sus propias alergias: un ingrediente del catálogo (filtro estricto, igual que un
--    alérgeno: ni siquiera opcional ni como opción) o un texto libre que la IA recibe como "no usar".
--    Es dato de salud: exige la autorización de datos sensibles y se borra al revocarla.

-- ---- 1. Lista revisada ------------------------------------------------------------------------------------
update public.allergens set name = 'Soya' where code = 'soy';
insert into public.allergens (code, name) values ('sulfites', 'Sulfitos') on conflict do nothing;

-- ---- 2. Alergias propias ----------------------------------------------------------------------------------
create table public.user_custom_allergies (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id) on delete cascade,
  label         text not null check (char_length(btrim(label)) between 1 and 40),
  created_at    timestamptz not null default now()
);
create unique index user_custom_allergies_label_uq on public.user_custom_allergies (user_id, lower(btrim(label)));
create index user_custom_allergies_ingredient_idx on public.user_custom_allergies (ingredient_id) where ingredient_id is not null;
comment on table public.user_custom_allergies is
  'US-187: alergias que la persona escribe. Con ingredient_id es un filtro estricto (como un alérgeno); sin él, la IA lo evita. Dato de salud (Ley 1581).';

alter table public.user_custom_allergies enable row level security;
create policy user_custom_allergies_own on public.user_custom_allergies for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, delete on public.user_custom_allergies to authenticated;

create trigger user_custom_allergies_sensitive_auth before insert on public.user_custom_allergies
  for each row execute function private.require_sensitive_authorization();

-- Reemplaza la lista completa (máximo 10). p_items: [{"label": "Tomate", "ingredient_id": "…"} | {"label": "Kiwi"}]
create function public.set_my_custom_allergies(p_items jsonb)
returns void language plpgsql set search_path = '' as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'invalid_input: se esperaba una lista' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 10 then
    raise exception 'too_many_custom_allergies: máximo 10 alergias propias' using errcode = 'P0001';
  end if;
  delete from public.user_custom_allergies where user_id = v_user;
  insert into public.user_custom_allergies (user_id, ingredient_id, label)
  select distinct on (lower(btrim(x->>'label'))) v_user, nullif(x->>'ingredient_id', '')::uuid, btrim(x->>'label')
  from jsonb_array_elements(p_items) x
  where coalesce(btrim(x->>'label'), '') <> '';
end $$;
revoke all on function public.set_my_custom_allergies(jsonb) from public, anon;
grant execute on function public.set_my_custom_allergies(jsonb) to authenticated;

-- ---- 3. Filtros estrictos: un ingrediente de alergia propia cuenta como un alérgeno ------------------------
create or replace function private.ingredient_allergic_for_user(p_ingredient_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.ingredient_allergens ia
                 join public.user_allergens ua on ua.allergen_id = ia.allergen_id
                 where ia.ingredient_id = p_ingredient_id and ua.user_id = p_user_id)
      or exists (select 1 from public.user_custom_allergies c
                 where c.user_id = p_user_id and c.ingredient_id = p_ingredient_id)
$$;

create or replace function private.ingredient_blocked_for_user(p_ingredient_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.ingredient_allergic_for_user(p_ingredient_id, p_user_id)
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

-- La receta choca si algún ingrediente (incluso opcional) es de alergia, o si un grupo obligatorio no se puede completar.
create or replace function private.recipe_conflicts_with_user(p_recipe_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
           select 1 from public.recipe_ingredients ri
           where ri.recipe_id = p_recipe_id and private.ingredient_allergic_for_user(ri.ingredient_id, p_user_id))
      or exists (
           select 1 from public.recipe_flex_groups g
           where g.recipe_id = p_recipe_id and g.min_choices > 0
             and (select count(*) from public.recipe_flex_options o
                  where o.recipe_id = g.recipe_id and o.group_key = g.group_key
                    and not private.ingredient_allergic_for_user(o.ingredient_id, p_user_id)) < g.min_choices)
$$;

-- ---- 4. Lo que sabe la IA, recetas del asistente, exportar y revocar (copias + US-187) ---------------------
create or replace function public.assistant_profile()
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
    -- alergias propias (US-187): lo que la persona escribió, sin decir que es una alergia
    select c.label from public.user_custom_allergies c, me where c.user_id = me.uid
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
                  or exists (select 1 from public.user_custom_allergies c where c.user_id = p.id)
                  or exists (select 1 from public.user_diets ud where ud.user_id = p.id)
  )
  from public.profiles p, me
  where p.id = me.uid
$$;

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
    v_slot     := coalesce(p_recipe ->> 'slot', p_recipe -> 'slots' ->> 0)::public.meal_slot;
    perform x::public.meal_slot from jsonb_array_elements_text(coalesce(p_recipe -> 'slots', '[]'::jsonb)) x;
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
               or exists (select 1 from public.user_custom_allergies c where c.user_id = v_user)
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
  -- ADR-039: una receta del plan con IA sirve para almuerzo y cena ("slots"); si no, su único momento.
  insert into public.recipe_meal_slots (recipe_id, slot)
  select distinct v_id, x::public.meal_slot
  from jsonb_array_elements_text(case when jsonb_typeof(p_recipe -> 'slots') = 'array' and jsonb_array_length(p_recipe -> 'slots') > 0
                                      then p_recipe -> 'slots' else jsonb_build_array(v_slot::text) end) x;
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
    'custom_allergies', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.user_custom_allergies t where t.user_id = v_user),
    'conditions',     (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.user_conditions t where t.user_id = v_user),
    'disliked_ingredients', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.user_disliked_ingredients t where t.user_id = v_user),
    'cuisines',       (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.user_cuisines t where t.user_id = v_user),
    'favorite_recipes', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.favorite_recipes t where t.user_id = v_user),
    'section_order',  (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.user_section_order t where t.user_id = v_user),
    'pantry',         (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.pantry_items t where t.user_id = v_user),
    'pantry_custom',  (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.pantry_custom_items t where t.user_id = v_user),
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

create or replace function public.revoke_consent(p_kind public.legal_doc_kind)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_n    int;
  v_out  jsonb := '{}'::jsonb;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_kind not in ('sensitive_data_authorization', 'community_sharing') then
    raise exception 'not_revocable: este documento no se revoca; para salir de la app elimina tu cuenta' using errcode = 'P0001';
  end if;

  update public.user_consents uc set revoked_at = now()
  from public.legal_documents ld
  where ld.id = uc.document_id and ld.kind = p_kind and uc.user_id = v_user and uc.revoked_at is null;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'consent_not_found: no hay una autorización vigente para revocar' using errcode = 'P0002'; end if;

  if p_kind = 'sensitive_data_authorization' then
    delete from public.user_allergens where user_id = v_user;        get diagnostics v_n = row_count; v_out := v_out || jsonb_build_object('user_allergens', v_n);
    delete from public.user_custom_allergies where user_id = v_user; get diagnostics v_n = row_count; v_out := v_out || jsonb_build_object('user_custom_allergies', v_n);
    delete from public.user_diets where user_id = v_user;            get diagnostics v_n = row_count; v_out := v_out || jsonb_build_object('user_diets', v_n);
    delete from public.user_conditions where user_id = v_user;       get diagnostics v_n = row_count; v_out := v_out || jsonb_build_object('user_conditions', v_n);
    delete from public.profile_health where user_id = v_user;        get diagnostics v_n = row_count; v_out := v_out || jsonb_build_object('profile_health', v_n);
  else
    delete from public.recipe_comments where user_id = v_user;       get diagnostics v_n = row_count; v_out := v_out || jsonb_build_object('comments', v_n);
    update public.recipes set status = 'draft' where author_id = v_user and status = 'published';
    get diagnostics v_n = row_count; v_out := v_out || jsonb_build_object('recipes_unpublished', v_n);
  end if;
  return v_out;
end $$;
