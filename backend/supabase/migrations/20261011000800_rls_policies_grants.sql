-- =============================================================================
-- 0008 · Seguridad: RLS en TODAS las tablas, políticas por usuario y privilegios mínimos
-- Un único archivo para poder auditar la seguridad de un vistazo.
-- Regla: lo que no tiene política explícita queda DENEGADO.
-- (select auth.uid()) en lugar de auth.uid(): Postgres lo evalúa una vez por consulta, no por fila.
-- =============================================================================

-- ---- 1. Activar RLS en cada tabla de public --------------------------------
do $$
declare t text;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---- 2. Referencia y catálogo: lectura para usuarios autenticados -----------
do $$
declare t text;
begin
  foreach t in array array[
    'countries','regions','food_groups','ingredient_categories','allergens','diets',
    'diet_excluded_food_groups','diet_excluded_allergens','cuisines','protein_sources','units',
    'medical_conditions','recommendation_reasons','rating_tags',
    'ingredients','ingredient_unit_weights','ingredient_nutrition','ingredient_allergens',
    'ingredient_substitutions','price_sources','ingredient_prices']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_select_auth', t);
  end loop;
end $$;

-- Los documentos legales se leen ANTES de registrarse (para mostrar la política y aceptarla)
create policy legal_documents_select_public on public.legal_documents
  for select to anon, authenticated using (true);

-- ---- 3. Datos propios del usuario (todas las operaciones sobre sus filas) ---
do $$
declare t text;
begin
  foreach t in array array[
    'user_diets','user_allergens','user_conditions','user_disliked_ingredients','user_cuisines',
    'favorite_recipes','user_section_order','pantry_items','meal_plans','shopping_lists','purchases',
    'push_devices','assistant_conversations','recipe_ratings']
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_own', t);
  end loop;
end $$;

create policy profile_health_own on public.profile_health for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notification_preferences_own on public.notification_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy user_roles_select_own on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()));

-- Consentimientos: historial inmutable (solo lectura e inserción)
create policy user_consents_select_own on public.user_consents for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_consents_insert_own on public.user_consents for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy support_tickets_select_own on public.support_tickets for select to authenticated
  using (user_id = (select auth.uid()));
create policy support_tickets_insert_own on public.support_tickets for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ---- 4. Tablas hijas: el acceso se hereda del padre -------------------------
create policy planned_meals_own on public.planned_meals for all to authenticated
  using (exists (select 1 from public.meal_plans p where p.id = plan_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.meal_plans p where p.id = plan_id and p.user_id = (select auth.uid())));

create policy meal_pantry_deductions_own on public.meal_pantry_deductions for all to authenticated
  using (exists (select 1 from public.planned_meals pm join public.meal_plans p on p.id = pm.plan_id
                 where pm.id = planned_meal_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.planned_meals pm join public.meal_plans p on p.id = pm.plan_id
                 where pm.id = planned_meal_id and p.user_id = (select auth.uid())));

create policy shopping_list_items_own on public.shopping_list_items for all to authenticated
  using (exists (select 1 from public.shopping_lists l where l.id = list_id and l.user_id = (select auth.uid())))
  with check (exists (select 1 from public.shopping_lists l where l.id = list_id and l.user_id = (select auth.uid())));

create policy purchase_items_own on public.purchase_items for all to authenticated
  using (exists (select 1 from public.purchases p where p.id = purchase_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.purchases p where p.id = purchase_id and p.user_id = (select auth.uid())));

create policy recipe_rating_tag_links_own on public.recipe_rating_tag_links for all to authenticated
  using (exists (select 1 from public.recipe_ratings r where r.id = rating_id and r.user_id = (select auth.uid())))
  with check (exists (select 1 from public.recipe_ratings r where r.id = rating_id and r.user_id = (select auth.uid())));

-- Mensajes del asistente: el usuario escribe los suyos; las respuestas las inserta el backend (service_role)
create policy assistant_messages_select_own on public.assistant_messages for select to authenticated
  using (exists (select 1 from public.assistant_conversations c where c.id = conversation_id and c.user_id = (select auth.uid())));
create policy assistant_messages_insert_user on public.assistant_messages for insert to authenticated
  with check (role = 'user' and exists (select 1 from public.assistant_conversations c
                                        where c.id = conversation_id and c.user_id = (select auth.uid())));
create policy assistant_messages_update_own on public.assistant_messages for update to authenticated
  using (exists (select 1 from public.assistant_conversations c where c.id = conversation_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.assistant_conversations c where c.id = conversation_id and c.user_id = (select auth.uid())));

-- ---- 5. Recetas: oficiales publicadas, propias y personal autorizado --------
create policy recipes_select on public.recipes for select to authenticated using (
  status = 'published'
  or author_id = (select auth.uid())
  or (select private.has_role('nutritionist'))
  or (select private.has_role('moderator'))
  or (select private.has_role('admin')));

create policy recipes_insert_own on public.recipes for insert to authenticated
  with check (author_id = (select auth.uid()) and status = 'draft');
-- el autor solo mueve su receta entre borrador y publicada; en revisión o rechazada ya depende de moderación
create policy recipes_update_own on public.recipes for update to authenticated
  using (author_id = (select auth.uid()) and status in ('draft', 'published'))
  with check (author_id = (select auth.uid()) and status in ('draft', 'published'));
create policy recipes_delete_own_draft on public.recipes for delete to authenticated
  using (author_id = (select auth.uid()) and status = 'draft');
create policy recipes_staff_official on public.recipes for all to authenticated
  using (author_id is null and ((select private.has_role('nutritionist')) or (select private.has_role('admin'))))
  with check (author_id is null and ((select private.has_role('nutritionist')) or (select private.has_role('admin'))));
create policy recipes_moderator_update on public.recipes for update to authenticated
  using ((select private.has_role('moderator'))) with check ((select private.has_role('moderator')));

do $$
declare t text;
begin
  foreach t in array array['recipe_ingredients','recipe_steps','recipe_meal_slots','recipe_diet_tags']
  loop
    -- leer: si puedes ver la receta, ves sus partes (RLS de recipes se aplica a la subconsulta)
    execute format('create policy %I on public.%I for select to authenticated
                      using (exists (select 1 from public.recipes r where r.id = recipe_id))', t || '_select', t);
    -- escribir: el autor sobre su borrador; el personal sobre recetas oficiales
    execute format('create policy %I on public.%I for all to authenticated
                      using (exists (select 1 from public.recipes r where r.id = recipe_id and r.author_id is null
                                     and ((select private.has_role(''nutritionist'')) or (select private.has_role(''admin'')))))
                      with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.author_id is null
                                     and ((select private.has_role(''nutritionist'')) or (select private.has_role(''admin'')))))',
                   t || '_staff_write', t);
  end loop;
end $$;
-- el autor edita las partes de SU borrador (las etiquetas curated solo las asigna el personal)
do $$
declare t text;
begin
  foreach t in array array['recipe_ingredients','recipe_steps','recipe_meal_slots']
  loop
    execute format('create policy %I on public.%I for all to authenticated
                      using (exists (select 1 from public.recipes r where r.id = recipe_id
                                     and r.author_id = (select auth.uid()) and r.status = ''draft''))
                      with check (exists (select 1 from public.recipes r where r.id = recipe_id
                                     and r.author_id = (select auth.uid()) and r.status = ''draft''))',
                   t || '_author_write', t);
  end loop;
end $$;

create policy nutritionist_reviews_select on public.nutritionist_reviews for select to authenticated using (
  (select private.has_role('nutritionist')) or (select private.has_role('admin')) or (select private.has_role('moderator'))
  or exists (select 1 from public.recipes r where r.id = recipe_id and r.author_id = (select auth.uid())));
create policy nutritionist_reviews_insert on public.nutritionist_reviews for insert to authenticated
  with check ((select private.has_role('nutritionist')) and reviewer_id = (select auth.uid()));

-- ---- 6. Comunidad -----------------------------------------------------------
create policy recipe_comments_select on public.recipe_comments for select to authenticated using (
  exists (select 1 from public.recipes r where r.id = recipe_id)
  and (hidden_at is null or user_id = (select auth.uid()) or (select private.has_role('moderator'))));
create policy recipe_comments_insert_own on public.recipe_comments for insert to authenticated
  with check (user_id = (select auth.uid()) and hidden_at is null);
create policy recipe_comments_delete on public.recipe_comments for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.has_role('moderator')));
create policy recipe_comments_moderator_update on public.recipe_comments for update to authenticated
  using ((select private.has_role('moderator'))) with check ((select private.has_role('moderator')));

create policy content_reports_insert_own on public.content_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
create policy content_reports_select on public.content_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select private.has_role('moderator')));
create policy content_reports_moderator_update on public.content_reports for update to authenticated
  using ((select private.has_role('moderator'))) with check ((select private.has_role('moderator')));

-- ---- 7. Analítica: solo inserción, y solo si el usuario no la desactivó -----
create policy analytics_events_insert on public.analytics_events for insert to authenticated
  with check (coalesce((select p.analytics_enabled from public.profiles p where p.id = (select auth.uid())), false));
-- notifications y ai_generations: sin políticas = solo service_role (backend)

-- ---- 8. Privilegios mínimos -------------------------------------------------
-- anon (sin sesión): nada, salvo leer documentos legales
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
grant select on public.legal_documents to anon;

-- TRUNCATE, REFERENCES y TRIGGER no están sujetos a RLS: nadie desde la API debe tenerlos
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

-- Solo lectura para catálogos
revoke insert, update, delete on
  public.countries, public.regions, public.food_groups, public.ingredient_categories, public.allergens,
  public.diets, public.diet_excluded_food_groups, public.diet_excluded_allergens, public.cuisines,
  public.protein_sources, public.units, public.medical_conditions, public.recommendation_reasons,
  public.rating_tags, public.ingredients, public.ingredient_unit_weights, public.ingredient_nutrition,
  public.ingredient_allergens, public.ingredient_substitutions, public.price_sources,
  public.ingredient_prices, public.legal_documents
  from authenticated;

-- Solo el backend toca estas tablas
revoke all on public.ai_generations, public.notifications from authenticated;
revoke insert, update, delete on public.user_roles from authenticated;

-- Historiales inmutables
revoke update, delete on public.user_consents from authenticated;
revoke update, delete on public.support_tickets from authenticated;

-- Del asistente el usuario solo puede marcar una sugerencia como aplicada
revoke update, delete on public.assistant_messages from authenticated;
grant  update (applied_at) on public.assistant_messages to authenticated;

-- El perfil lo crea el trigger de alta; la cuenta se elimina por la API de Auth
revoke insert, delete on public.profiles from authenticated;

-- Funciones: nadie sin sesión las ejecuta
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated, service_role;

-- Objetos FUTUROS en public nacen cerrados para anon
alter default privileges for role postgres in schema public revoke all on tables    from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;

-- Vistas
grant select on public.recipe_rating_stats to authenticated;
