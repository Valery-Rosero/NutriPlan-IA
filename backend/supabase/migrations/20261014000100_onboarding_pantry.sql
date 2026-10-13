-- =============================================================================
-- 0014 · Sprint 2: onboarding, perfil y despensa
-- =============================================================================

-- En Colombia se compra por libras (500 g), no por la libra imperial.
insert into public.units (code, name, dimension, factor, rounding_step)
values ('lb', 'libra (500 g)', 'mass', 500, 0.5)
on conflict (code) do nothing;

-- Guarda alergias y dietas en UNA transacción (US-106, US-107, US-116).
-- Reemplaza el conjunto completo: lo que no viene se borra. Los triggers siguen exigiendo
-- la autorización de datos sensibles para insertar y purgan favoritos con alérgenos nuevos.
create function public.set_my_restrictions(p_allergen_ids smallint[], p_diet_ids smallint[])
returns void
language plpgsql set search_path = '' as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  delete from public.user_allergens
  where user_id = v_user and allergen_id <> all (coalesce(p_allergen_ids, '{}'));
  insert into public.user_allergens (user_id, allergen_id)
  select v_user, a from unnest(coalesce(p_allergen_ids, '{}')) a
  on conflict do nothing;

  delete from public.user_diets
  where user_id = v_user and diet_id <> all (coalesce(p_diet_ids, '{}'));
  insert into public.user_diets (user_id, diet_id)
  select v_user, d from unnest(coalesce(p_diet_ids, '{}')) d
  on conflict do nothing;
end $$;

revoke execute on function public.set_my_restrictions(smallint[], smallint[]) from public, anon;
grant execute on function public.set_my_restrictions(smallint[], smallint[]) to authenticated, service_role;
