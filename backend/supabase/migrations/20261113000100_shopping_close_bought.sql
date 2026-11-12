-- Lista de mercado: al pasar lo comprado a la despensa, la compra se CIERRA.
-- Antes, los ítems manuales marcados ("bolsas", "servilletas") no tienen ingrediente, no pasaban a la
-- despensa y se quedaban tachados en la lista para siempre. Ahora también se marcan con
-- moved_to_pantry_at (= "compra cerrada"), y la app deja de mostrarlos. Solo se cuentan en el resultado
-- los ítems que de verdad entraron a la despensa.
create or replace function public.move_checked_to_pantry(p_list_id uuid)
returns integer
language plpgsql set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_g    smallint := (select id from public.units where code = 'g');
  v_n    integer := 0;
  r      record;
begin
  if not exists (select 1 from public.shopping_lists where id = p_list_id and user_id = v_user) then
    raise exception 'list_not_found' using errcode = 'P0002';
  end if;
  for r in
    select sli.id, sli.ingredient_id, sli.to_buy_g, i.shelf_life_days
    from public.shopping_list_items sli join public.ingredients i on i.id = sli.ingredient_id
    where sli.list_id = p_list_id and sli.is_checked and sli.moved_to_pantry_at is null and coalesce(sli.to_buy_g, 0) > 0
    for update of sli
  loop
    perform public.add_to_pantry(r.ingredient_id, r.to_buy_g, v_g,
                                 case when r.shelf_life_days is not null then current_date + r.shelf_life_days end);
    update public.shopping_list_items set moved_to_pantry_at = now() where id = r.id;
    v_n := v_n + 1;
  end loop;

  -- Lo manual marcado (sin ingrediente) no va a la despensa, pero la compra ya se hizo: se cierra.
  update public.shopping_list_items set moved_to_pantry_at = now()
  where list_id = p_list_id and is_checked and moved_to_pantry_at is null and ingredient_id is null;

  return v_n;
end $$;

comment on function public.move_checked_to_pantry(uuid) is
  'Pasa a la despensa lo marcado como comprado (con vencimiento según la vida útil) y cierra los ítems manuales marcados. Devuelve cuántos ítems entraron a la despensa.';
