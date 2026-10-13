-- =============================================================================
-- Catálogo real · 01 · Ingredientes de cocina colombiana (piloto Pasto)
-- Nutrición por 100 g: valores de referencia de USDA FoodData Central (CC0), aproximados y
-- pendientes de verificar contra la TCAC del ICBF (cuando haya permiso). Precios: aún no (US-112).
-- Alérgenos revisados con criterio conservador (la avena se marca con gluten por contaminación cruzada).
-- Idempotente: se puede volver a correr; no pisa ingredientes existentes.
-- =============================================================================

create temp table _ing (
  name text, fg text, cat text, dens numeric, heat int, shelf int, rnd numeric, staple boolean,
  kcal numeric, p numeric, c numeric, f numeric, fib numeric, sug numeric, na numeric,
  allergens text[], units jsonb, source text
);

insert into _ing values
-- cereales, harinas y panes
 ('Arroz blanco',              'grains','pantry',0.85,0,365,null,false, 365,7.13,79.95,0.66,1.3,0.12,5,     '{}',       '{}', null),
 ('Pasta seca',                'grains','pantry',0.6,0,365,null,false,  371,13.04,74.67,1.51,3.2,2.67,6,    '{gluten}', '{}', null),
 ('Avena en hojuelas',         'grains','pantry',0.35,0,300,null,false, 379,13.15,67.7,6.52,10.1,0.99,6,    '{gluten}', '{}', null),
 ('Harina de maíz precocida',  'grains','pantry',0.6,0,365,null,false,  365,9.28,76.3,3.84,6.4,1.6,5,       '{}',       '{}', null),
 ('Arepa de maíz',             'grains','bakery',1.0,0,7,0.5,false,     180,4.6,38.0,1.9,3.2,0.8,200,       '{}',       '{"unit":80}', 'Cálculo: harina de maíz precocida (USDA) + agua y sal'),
 ('Pan blanco',                'grains','bakery',0.3,0,5,1,false,       266,8.85,49.42,3.29,2.7,5.67,490,   '{gluten}', '{"unit":30}', null),
-- tubérculos y plátanos
 ('Papa',                      'tubers','produce',1.0,0,30,null,false,  77,2.05,17.49,0.09,2.1,0.82,6,      '{}',       '{"unit":170}', null),
 ('Papa criolla',              'tubers','produce',1.0,0,15,null,false,  77,2.05,17.49,0.09,2.1,0.82,6,      '{}',       '{"unit":40}', 'USDA: papa cruda (referencia)'),
 ('Yuca',                      'tubers','produce',1.0,0,7,null,false,   160,1.36,38.06,0.28,1.8,1.7,14,     '{}',       '{"unit":400}', null),
 ('Plátano verde',             'fruits','produce',1.0,0,10,null,false,  122,1.3,31.89,0.37,2.3,15,4,        '{}',       '{"unit":280}', 'USDA: plátano crudo (referencia)'),
 ('Plátano maduro',            'fruits','produce',1.0,0,5,null,false,   122,1.3,31.89,0.37,2.3,15,4,        '{}',       '{"unit":250}', 'USDA: plátano crudo (referencia)'),
-- legumbres
 ('Fríjol rojo seco',          'legumes','pantry',0.8,0,365,null,false, 333,23.58,60.01,0.83,24.9,2.23,12,  '{}',       '{}', null),
 ('Fríjol cocido',             'legumes','pantry',1.0,0,4,null,false,   127,8.67,22.8,0.5,6.4,0.32,2,       '{}',       '{}', null),
 ('Lentejas secas',            'legumes','pantry',0.8,0,365,null,false, 352,24.63,63.35,1.06,10.7,2.03,6,   '{}',       '{}', null),
 ('Garbanzos cocidos',         'legumes','pantry',1.0,0,4,null,false,   164,8.86,27.42,2.59,7.6,4.8,7,      '{}',       '{}', null),
-- proteínas animales
 ('Huevo',                     'egg','dairy_eggs',1.0,0,21,1,false,     143,12.56,0.72,9.51,0,0.37,142,     '{egg}',    '{"unit":50}', null),
 ('Pechuga de pollo',          'poultry','meat_fish',1.0,0,2,null,false,120,22.5,0,2.62,0,0,45,             '{}',       '{}', null),
 ('Muslo de pollo',            'poultry','meat_fish',1.0,0,2,null,false,119,19.65,0,4.12,0,0,84,            '{}',       '{}', null),
 ('Carne de res molida',       'red_meat','meat_fish',1.0,0,2,null,false,215,18.59,0,15,0,0,66,             '{}',       '{}', null),
 ('Carne de res para sudar',   'red_meat','meat_fish',1.0,0,2,null,false,140,22,0,5.5,0,0,58,               '{}',       '{}', null),
 ('Cerdo',                     'red_meat','meat_fish',1.0,0,2,null,false,136,20.5,0,5.4,0,0,60,             '{}',       '{}', null),
 ('Atún en lata',              'fish','pantry',1.0,0,730,1,false,       116,25.51,0,0.82,0,0,247,           '{fish}',   '{"unit":120}', 'USDA: atún claro en agua, escurrido'),
 ('Sardinas en lata',          'fish','pantry',1.0,0,730,1,false,       186,20.86,0.74,10.45,0.1,0.43,414,  '{fish}',   '{"unit":155}', 'USDA: sardinas en salsa de tomate'),
 ('Queso campesino',           'dairy','dairy_eggs',1.0,0,10,null,false,299,18.09,2.98,23.82,0,2.98,751,     '{milk}',   '{}', 'USDA: queso fresco (referencia)'),
 ('Leche entera',              'dairy','dairy_eggs',1.03,0,7,null,false,61,3.15,4.8,3.25,0,4.8,43,         '{milk}',   '{}', null),
-- verduras
 ('Tomate',                    'vegetables','produce',1.0,0,7,null,false,18,0.88,3.89,0.2,1.2,2.63,5,        '{}',       '{"unit":120}', null),
 ('Cebolla larga',             'vegetables','produce',1.0,0,7,null,false,32,1.83,7.34,0.19,2.6,2.33,16,      '{}',       '{"unit":40}', 'USDA: cebolla de verdeo'),
 ('Cebolla cabezona',          'vegetables','produce',1.0,0,30,null,false,40,1.1,9.34,0.1,1.7,4.24,4,        '{}',       '{"unit":150}', null),
 ('Ajo',                       'vegetables','produce',1.0,0,30,1,true,  149,6.36,33.06,0.5,2.1,1,17,        '{}',       '{"clove":4}', null),
 ('Zanahoria',                 'vegetables','produce',1.0,0,21,null,false,41,0.93,9.58,0.24,2.8,4.74,69,     '{}',       '{"unit":80}', null),
 ('Habichuela',                'vegetables','produce',1.0,0,6,null,false,31,1.83,6.97,0.22,2.7,3.26,6,       '{}',       '{}', null),
 ('Arveja verde',              'vegetables','produce',1.0,0,5,null,false,81,5.42,14.45,0.4,5.7,5.67,5,       '{}',       '{}', null),
 ('Brócoli',                   'vegetables','produce',0.4,0,6,null,false,34,2.82,6.64,0.37,2.6,1.7,33,       '{}',       '{}', null),
 ('Espinaca',                  'vegetables','produce',0.3,0,5,null,false,23,2.86,3.63,0.39,2.2,0.42,79,      '{}',       '{"handful":30}', null),
 ('Ahuyama',                   'vegetables','produce',1.0,0,30,null,false,26,1,6.5,0.1,0.5,2.76,1,           '{}',       '{}', 'USDA: calabaza cruda'),
 ('Mazorca',                   'vegetables','produce',1.0,0,5,null,false,86,3.27,18.7,1.35,2,6.26,15,        '{}',       '{"unit":150}', 'USDA: maíz dulce crudo (granos)'),
 ('Repollo',                   'vegetables','produce',1.0,0,14,null,false,25,1.28,5.8,0.1,2.5,3.2,18,        '{}',       '{}', null),
 ('Pimentón',                  'vegetables','produce',1.0,0,10,null,false,31,1,6.03,0.3,2.1,4.2,4,           '{}',       '{"unit":150}', null),
 ('Pepino',                    'vegetables','produce',1.0,0,7,null,false,15,0.65,3.63,0.11,0.5,1.67,2,       '{}',       '{"unit":200}', null),
 ('Champiñones',               'vegetables','produce',1.0,0,5,null,false,22,3.09,3.26,0.34,1,1.98,5,         '{}',       '{}', null),
-- frutas
 ('Aguacate',                  'fruits','produce',1.0,0,5,null,false,   160,2,8.53,14.66,6.7,0.66,7,        '{}',       '{"unit":170}', null),
 ('Banano',                    'fruits','produce',1.0,0,5,null,false,   89,1.09,22.84,0.33,2.6,12.23,1,     '{}',       '{"unit":120}', null),
 ('Limón',                     'fruits','produce',1.0,0,14,null,false,  30,0.7,10.54,0.2,2.8,1.69,2,       '{}',       '{"unit":60}', null),
 ('Mango',                     'fruits','produce',1.0,0,6,null,false,   60,0.82,14.98,0.38,1.6,13.66,1,     '{}',       '{"unit":300}', null),
 ('Manzana',                   'fruits','produce',1.0,0,21,null,false,  52,0.26,13.81,0.17,2.4,10.39,1,    '{}',       '{"unit":180}', null),
 ('Fresa',                     'fruits','produce',1.0,0,4,null,false,   32,0.67,7.68,0.3,2,4.89,1,          '{}',       '{}', null),
-- básicos de cocina
 ('Sal',                       'herbs_spices','spices_condiments',1.2,0,1800,null,true, 0,0,0,0,0,0,38758, '{}',       '{"pinch":0.4}', null),
 ('Aceite vegetal',            'fats_oils','pantry',0.92,0,365,null,true, 884,0,0,100,0,0,0,               '{}',       '{}', null),
 ('Comino molido',             'herbs_spices','spices_condiments',0.45,0,720,null,true, 375,17.81,44.24,22.27,10.5,2.25,168, '{}', '{"pinch":0.3}', null),
 ('Cilantro',                  'herbs_spices','produce',0.2,0,7,null,false, 23,2.13,3.67,0.52,2.8,0.87,46,  '{}',       '{"handful":10}', null),
 ('Panela',                    'other','pantry',0.9,0,365,null,false,   380,0.12,98.09,0,0,97.02,28,        '{}',       '{}', 'USDA: azúcar morena (referencia)'),
 ('Agua',                      'other','other',1.0,0,3650,null,true,    0,0,0,0,0,0,0,                      '{}',       '{}', 'Agua potable');

-- Ingredientes (no pisa los que ya existan con el mismo nombre)
insert into public.ingredients (name, food_group_id, store_category_id, density_g_per_ml, heat_level,
                                shelf_life_days, rounding_step, is_staple)
select i.name, g.id, c.id, i.dens, i.heat, i.shelf, i.rnd, i.staple
from _ing i
join public.food_groups g on g.code = i.fg
join public.ingredient_categories c on c.code = i.cat
on conflict ((lower(name))) do nothing;

insert into public.ingredient_nutrition (ingredient_id, kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg,
                                         source, reference_url)
select ing.id, i.kcal, i.p, i.c, i.f, i.fib, i.sug, i.na,
       coalesce(i.source, 'USDA FoodData Central') || ' · aproximado, por verificar', 'https://fdc.nal.usda.gov/'
from _ing i join public.ingredients ing on lower(ing.name) = lower(i.name)
on conflict (ingredient_id) do nothing;

insert into public.ingredient_allergens (ingredient_id, allergen_id)
select ing.id, a.id
from _ing i
join public.ingredients ing on lower(ing.name) = lower(i.name)
cross join lateral unnest(i.allergens) al(code)
join public.allergens a on a.code = al.code
on conflict do nothing;

insert into public.ingredient_unit_weights (ingredient_id, unit_id, grams)
select ing.id, u.id, w.value::numeric
from _ing i
join public.ingredients ing on lower(ing.name) = lower(i.name)
cross join lateral jsonb_each_text(i.units) w
join public.units u on u.code = w.key
on conflict do nothing;

-- Revisión de alérgenos (R3): hecha con criterio conservador para el piloto (ADR-021).
update public.ingredients ing set allergens_reviewed_at = now()
from _ing i where lower(ing.name) = lower(i.name) and ing.allergens_reviewed_at is null;

drop table _ing;
