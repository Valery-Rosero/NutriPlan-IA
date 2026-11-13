-- B3b (ADR-027): alimentos propios en la despensa ("queso campesino", "galletas de la tienda").
-- Tabla APARTE de pantry_items a propósito: doce funciones (cocinar, generar plan y lista, avisos…)
-- cruzan pantry_items con el catálogo y una suma lotes con su restricción única. Un alimento sin ficha
-- en el catálogo no sirve para calcular recetas, así que vive aquí y esas funciones no cambian.
-- Grupo y sección los sugiere categorize-food (informativo; no se usa para alergias).

create table public.pantry_custom_items (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name               text not null check (char_length(btrim(name)) between 1 and 80),
  food_group_id      smallint references public.food_groups (id),
  store_category_id  smallint references public.ingredient_categories (id),
  quantity           numeric(10, 2) not null check (quantity > 0 and quantity <= 100000),
  -- Lo que escribió la persona, tal cual: g, kg, libras, ml, litros o unidades (sin pasar a gramos).
  unit               text not null check (unit in ('g', 'kg', 'lb', 'ml', 'l', 'unit')),
  expires_on         date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index pantry_custom_items_user_idx on public.pantry_custom_items (user_id, expires_on);
create trigger pantry_custom_items_updated_at before update on public.pantry_custom_items
  for each row execute function private.set_updated_at();
comment on table public.pantry_custom_items is
  'Despensa: alimentos fuera del catálogo (B3b, ADR-027). No entran en recetas, plan ni lista; solo se muestran y se exportan. La cantidad queda en la unidad que escribió la persona.';

alter table public.pantry_custom_items enable row level security;
create policy pantry_custom_items_own on public.pantry_custom_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.pantry_custom_items from anon;
grant select, insert, update, delete on public.pantry_custom_items to authenticated;

-- Derecho de acceso y portabilidad: la exportación incluye también los alimentos propios.
-- Copia exacta de la versión de 20261013000200_flexible_recipes.sql más la clave 'pantry_custom'.
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
