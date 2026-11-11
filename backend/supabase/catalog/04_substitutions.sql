-- Sustitutos del catálogo (US-147). Culinarios y entre ingredientes que ya existen; los que no aplican
-- a una persona (alergias, dietas) los filtra suggest_substitutes_for al consultar. Idempotente.
insert into public.ingredient_substitutions (ingredient_id, substitute_id, ratio, note)
select a.id, b.id, v.r, v.n
from (values
  ('Pechuga de pollo', 'Muslo de pollo', 1, null),
  ('Muslo de pollo', 'Pechuga de pollo', 1, 'Queda un poco más seca: no la cocines de más.'),
  ('Carne de res molida', 'Carne de res para sudar', 1, 'Pícala bien fina.'),
  ('Carne de res para sudar', 'Carne de res molida', 1, 'Se cocina más rápido.'),
  ('Atún en lata', 'Sardinas en lata', 1, null),
  ('Sardinas en lata', 'Atún en lata', 1, null),
  ('Fríjol rojo seco', 'Fríjol cocido', 2.5, 'Ya cocido: agrégalo al final, sin remojar.'),
  ('Fríjol cocido', 'Garbanzos cocidos', 1, null),
  ('Garbanzos cocidos', 'Fríjol cocido', 1, null),
  ('Lentejas secas', 'Fríjol rojo seco', 1, 'El fríjol necesita remojo y más cocción.'),
  ('Papa', 'Papa criolla', 1, 'Se deshace más rápido: agrégala después.'),
  ('Papa', 'Yuca', 1, 'Necesita más cocción.'),
  ('Papa criolla', 'Papa', 1, null),
  ('Yuca', 'Papa', 1, null),
  ('Plátano verde', 'Yuca', 1, null),
  ('Cebolla larga', 'Cebolla cabezona', 1, null),
  ('Cebolla cabezona', 'Cebolla larga', 1, null),
  ('Habichuela', 'Arveja verde', 1, null),
  ('Arveja verde', 'Habichuela', 1, null),
  ('Pan blanco', 'Arepa de maíz', 1, null),
  ('Arepa de maíz', 'Pan blanco', 1, null),
  ('Leche entera', 'Agua', 1, 'Para avena o caldos: queda menos cremoso.'),
  ('Banano', 'Mango', 1, null),
  ('Mango', 'Banano', 1, null),
  ('Fresa', 'Mango', 1, null),
  ('Manzana', 'Banano', 1, null)
) v(a, b, r, n)
join public.ingredients a on a.name = v.a
join public.ingredients b on b.name = v.b
on conflict do nothing;
