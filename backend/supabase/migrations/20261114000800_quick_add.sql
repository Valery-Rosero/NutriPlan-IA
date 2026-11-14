-- ADR-036 · Mi cocina, fase 4 (D2): el agregado rápido viene de la base, no de nombres escritos en la app.
-- Antes la app buscaba cada ingrediente por su nombre exacto (dos consultas por toque) y, si el catálogo
-- cambiaba un nombre ("Plátano verde"), el botón fallaba en silencio. Ahora es una tabla de referencia
-- ligada al ingrediente por su id: cambiar el nombre no la rompe.

create table public.quick_add_items (
  ingredient_id uuid primary key references public.ingredients (id) on delete cascade,
  quantity      numeric(10, 2) not null check (quantity > 0),
  unit_id       smallint not null references public.units (id),
  position      smallint not null default 0
);
comment on table public.quick_add_items is
  'ADR-036: lo típico de una cocina colombiana para agregar con un toque (cantidad típica de compra). Datos de referencia.';

alter table public.quick_add_items enable row level security;
create policy quick_add_items_read on public.quick_add_items for select to authenticated using (true);
grant select on public.quick_add_items to authenticated;

-- Mismo contenido que catalog/05_quick_add.sql (aquí por si el catálogo ya estaba cargado). Idempotente.
insert into public.quick_add_items (ingredient_id, quantity, unit_id, position)
select i.id, v.q, u.id, v.pos
from (values
  ('Arroz blanco', 1, 'kg', 1), ('Papa', 1, 'kg', 2), ('Huevo', 6, 'unit', 3), ('Tomate', 4, 'unit', 4),
  ('Cebolla cabezona', 2, 'unit', 5), ('Plátano verde', 2, 'unit', 6), ('Fríjol rojo seco', 500, 'g', 7),
  ('Lentejas secas', 500, 'g', 8), ('Pasta seca', 500, 'g', 9), ('Arepa de maíz', 5, 'unit', 10),
  ('Zanahoria', 3, 'unit', 11), ('Pechuga de pollo', 500, 'g', 12), ('Carne de res molida', 500, 'g', 13),
  ('Queso campesino', 250, 'g', 14), ('Banano', 4, 'unit', 15), ('Avena en hojuelas', 500, 'g', 16)
) v(name, q, unit, pos)
join public.ingredients i on i.name = v.name
join public.units u on u.code = v.unit
on conflict (ingredient_id) do nothing;
