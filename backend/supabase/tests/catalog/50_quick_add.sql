-- ===================== Catálogo real: agregado rápido (ADR-036, migración 20261114000800) =====================
do $$
declare
  v_bad text;
begin
  perform tt.ok((select count(*) from public.quick_add_items) = 16, 'el agregado rápido tiene sus 16 ingredientes en el catálogo real');
  -- Cada cantidad típica se puede pasar a gramos con su unidad (si no, el toque fallaría al agregar).
  select string_agg(i.name, ', ') into v_bad
  from public.quick_add_items q join public.ingredients i on i.id = q.ingredient_id
  where private.to_grams(q.ingredient_id, q.quantity, q.unit_id) is null;
  perform tt.ok(v_bad is null, 'cada cantidad típica se convierte a gramos con su unidad');
  perform tt.login('a0000000-0000-4000-8000-00000000000a');
  perform tt.ok((select count(*) from public.quick_add_items) = 16, 'cualquier persona con sesión la puede leer');
  perform tt.reset();
end $$;
