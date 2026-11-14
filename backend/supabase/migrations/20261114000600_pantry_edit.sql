-- ADR-034 · Mi cocina, fase 2: corregir lo que hay (revisión de Mi cocina, C3 · A6 · M1 · M2).
--   * adjust_pantry: sumar o restar de un ingrediente (−/+, ¼ ½ ¾, "se acabó", deshacer el agregado rápido).
--     Restar descuenta primero lo que vence antes (igual que cocinar); sumar va al lote que más dura.
--   * set_pantry_expiry: cambiar la fecha de un lote ("todavía sirve" o corregirla). Si ya hay otro lote con
--     esa fecha, se juntan (pantry_batch_uq) sin perder lo que se descontó al cocinar (para poder deshacer).
--   * remove_expired_pantry: "Quitar lo vencido" de una vez (catálogo y alimentos propios).
-- Los alimentos propios (B3b) se editan directo en su tabla: la RLS ya limita a los de cada persona.

-- ---- Sumar o restar ------------------------------------------------------------------------------------
create function public.adjust_pantry(p_ingredient_id uuid, p_quantity numeric, p_unit_id smallint default null)
returns numeric
language plpgsql set search_path = '' as $$
declare
  v_user  uuid := (select auth.uid());
  v_g     numeric;
  v_need  numeric;
  v_take  numeric;
  v_batch record;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_quantity is null or p_quantity = 0 or abs(p_quantity) > 100000 then
    raise exception 'invalid_quantity: la cantidad debe ser distinta de 0' using errcode = '22023';
  end if;

  -- Sin unidad = gramos (lo que usa la app al corregir); con unidad se convierte (falla con unit_incompatible).
  v_g := case when p_unit_id is null then round(abs(p_quantity), 2)
              else round(private.to_grams(p_ingredient_id, abs(p_quantity), p_unit_id), 2) end;

  if p_quantity > 0 then
    -- Al lote vigente que más dura (sin fecha cuenta como el que más); si no hay, uno nuevo con su vida útil.
    select pi.id into v_batch from public.pantry_items pi
    where pi.user_id = v_user and pi.ingredient_id = p_ingredient_id
      and (pi.expires_on is null or pi.expires_on >= current_date)
    order by pi.expires_on desc nulls first
    limit 1;
    if v_batch.id is not null then
      update public.pantry_items set quantity_g = quantity_g + v_g where id = v_batch.id;
    else
      insert into public.pantry_items (user_id, ingredient_id, quantity_g, expires_on)
      values (v_user, p_ingredient_id, v_g,
              (select case when i.shelf_life_days is not null then current_date + i.shelf_life_days end
               from public.ingredients i where i.id = p_ingredient_id))
      on conflict on constraint pantry_batch_uq
      do update set quantity_g = public.pantry_items.quantity_g + excluded.quantity_g;
    end if;
  else
    -- Primero lo que vence antes (lo vencido no se toca: tiene sus propias acciones).
    v_need := v_g;
    for v_batch in
      select pi.id, pi.quantity_g from public.pantry_items pi
      where pi.user_id = v_user and pi.ingredient_id = p_ingredient_id
        and pi.quantity_g > 0 and (pi.expires_on is null or pi.expires_on >= current_date)
      order by pi.expires_on nulls last, pi.created_at
      for update
    loop
      exit when v_need <= 0;
      v_take := least(v_batch.quantity_g, v_need);
      update public.pantry_items set quantity_g = quantity_g - v_take where id = v_batch.id;
      v_need := v_need - v_take;
    end loop;
    -- Lo que quedó en 0 y no sirve para deshacer una comida se borra (no ensucia la despensa).
    delete from public.pantry_items pi
    where pi.user_id = v_user and pi.ingredient_id = p_ingredient_id and pi.quantity_g <= 0
      and not exists (select 1 from public.meal_pantry_deductions d where d.pantry_item_id = pi.id);
  end if;

  return (select coalesce(sum(pi.quantity_g), 0) from public.pantry_items pi
          where pi.user_id = v_user and pi.ingredient_id = p_ingredient_id
            and (pi.expires_on is null or pi.expires_on >= current_date));
end $$;
comment on function public.adjust_pantry(uuid, numeric, smallint) is
  'ADR-034: suma (cantidad > 0) o resta (< 0) de un ingrediente. Resta primero lo que vence antes; devuelve el total vigente en gramos.';

-- ---- Cambiar la fecha de un lote -----------------------------------------------------------------------
create function public.set_pantry_expiry(p_item_id uuid, p_expires_on date)
returns void
language plpgsql set search_path = '' as $$
declare
  v_user  uuid := (select auth.uid());
  v_item  public.pantry_items;
  v_other uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_expires_on is not null and p_expires_on > current_date + 730 then
    raise exception 'invalid_date: la fecha está demasiado lejos' using errcode = '22023';
  end if;
  select * into v_item from public.pantry_items where id = p_item_id and user_id = v_user for update;
  if not found then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;
  if v_item.expires_on is not distinct from p_expires_on then
    return;
  end if;

  select id into v_other from public.pantry_items
  where user_id = v_user and ingredient_id = v_item.ingredient_id and expires_on is not distinct from p_expires_on
  for update;
  if v_other is null then
    update public.pantry_items set expires_on = p_expires_on where id = p_item_id;
  else
    -- Ya hay un lote con esa fecha: se juntan. Lo descontado al cocinar apunta al lote que queda.
    update public.pantry_items set quantity_g = quantity_g + v_item.quantity_g where id = v_other;
    update public.meal_pantry_deductions set pantry_item_id = v_other where pantry_item_id = p_item_id;
    delete from public.pantry_items where id = p_item_id;
  end if;
end $$;
comment on function public.set_pantry_expiry(uuid, date) is
  'ADR-034: cambia el vencimiento de un lote (null = sin fecha). Si ya existe un lote con esa fecha, se juntan.';

-- ---- Quitar lo vencido ---------------------------------------------------------------------------------
create function public.remove_expired_pantry()
returns integer
language plpgsql set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_n    integer;
  v_c    integer;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  delete from public.pantry_items where user_id = v_user and expires_on < current_date;
  get diagnostics v_n = row_count;
  delete from public.pantry_custom_items where user_id = v_user and expires_on < current_date;
  get diagnostics v_c = row_count;
  return v_n + v_c;
end $$;
comment on function public.remove_expired_pantry() is 'ADR-034: "Quitar lo vencido" (catálogo y alimentos propios). Devuelve cuántos quitó.';

revoke all on function public.adjust_pantry(uuid, numeric, smallint) from public, anon;
revoke all on function public.set_pantry_expiry(uuid, date) from public, anon;
revoke all on function public.remove_expired_pantry() from public, anon;
grant execute on function public.adjust_pantry(uuid, numeric, smallint) to authenticated;
grant execute on function public.set_pantry_expiry(uuid, date) to authenticated;
grant execute on function public.remove_expired_pantry() to authenticated;
