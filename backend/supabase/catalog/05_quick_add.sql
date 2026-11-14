-- Agregado rápido (ADR-024, ADR-036): lo que casi toda cocina colombiana tiene, con una cantidad típica de
-- compra. La app lo lee de la base (quick_add_items), ligado al ingrediente por su id. Idempotente.
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
