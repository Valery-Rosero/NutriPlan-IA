-- =====================================================================
-- tests/fixtures.sql — DATOS DE PRUEBA para las pruebas SQL (no es el catálogo real; ver catalog/).
-- Datos ILUSTRATIVOS: los valores nutricionales son aproximados y los precios
-- (COP/kg) están inventados. NO usar en producción. Antes de lanzar hay que
-- cargar datos verificados (p. ej. tabla de composición de alimentos del ICBF)
-- y precios de una fuente con licencia clara.
-- =====================================================================

insert into public.price_sources (name, license_notes)
values ('Datos de ejemplo (dev)', 'Ilustrativo; no es una fuente real');

-- name, grupo, categoría tienda, densidad, picante, vida útil, redondeo, kcal,prot,carb,grasa,fibra,azúcar,sodio, precio/kg
create temp table _ing (
  name text, fg text, cat text, dens numeric, heat int, shelf int, rnd numeric,
  kcal numeric, p numeric, c numeric, f numeric, fib numeric, sug numeric, na numeric, price numeric
);
insert into _ing values
 ('Garbanzos cocidos','legumes','pantry',1.0,0,5,null,164,8.9,27.4,2.6,7.6,4.8,7,9000),
 ('Lentejas secas','legumes','pantry',0.8,0,365,null,353,25.8,60.1,1.1,30.5,2,6,6000),
 ('Espinaca','vegetables','produce',0.3,0,5,null,23,2.9,3.6,0.4,2.2,0.4,79,8000),
 ('Ajo','vegetables','produce',1.0,0,30,1,149,6.4,33,0.5,2.1,1,17,14000),
 ('Aceite de oliva','fats_oils','pantry',0.91,0,540,null,884,0,0,100,0,0,2,35000),
 ('Limón','fruits','produce',1.0,0,14,null,29,1.1,9.3,0.3,2.8,2.5,2,5000),
 ('Comino molido','herbs_spices','spices_condiments',0.45,0,720,null,375,17.8,44.2,22.3,10.5,2.3,168,40000),
 ('Sal','herbs_spices','spices_condiments',1.2,0,1800,null,0,0,0,0,0,0,38758,2000),
 ('Avena en hojuelas','grains','pantry',0.35,0,300,null,379,13.2,67.7,6.5,10.1,1,6,7000),
 ('Leche entera','dairy','dairy_eggs',1.03,0,7,null,61,3.2,5.0,3.3,0,5.0,43,4000),
 ('Banano','fruits','produce',1.0,0,5,null,89,1.1,22.8,0.3,2.6,12.2,1,3500),
 ('Almendras','nuts_seeds','pantry',0.6,0,180,null,579,21.2,21.6,49.9,12.5,4.4,1,60000),
 ('Maní','nuts_seeds','pantry',0.6,0,180,null,567,25.8,16.1,49.2,8.5,4.7,18,18000),
 ('Zanahoria','vegetables','produce',1.0,0,21,null,41,0.9,9.6,0.2,2.8,4.7,69,2500),
 ('Cebolla cabezona','vegetables','produce',1.0,0,30,null,40,1.1,9.3,0.1,1.7,4.2,4,3000),
 ('Papa','tubers','produce',1.0,0,30,null,77,2,17,0.1,2.2,0.8,6,2800),
 ('Pechuga de pollo','poultry','meat_fish',1.0,0,2,null,165,31,0,3.6,0,0,74,18000),
 ('Arroz blanco','grains','pantry',0.85,0,365,null,360,6.7,79.3,0.6,1.3,0.1,5,4500),
 ('Brócoli','vegetables','produce',0.4,0,6,null,34,2.8,6.6,0.4,2.6,1.7,33,7000),
 ('Ají picante','vegetables','produce',1.0,3,10,null,40,1.9,8.8,0.4,1.5,5.3,9,12000),
 ('Huevo','egg','dairy_eggs',1.0,0,21,1,143,12.6,0.7,9.5,0,0.4,142,9000),
 ('Cilantro','herbs_spices','produce',0.2,0,7,null,23,2.1,3.7,0.5,2.8,0.9,46,12000);

insert into public.ingredients (name, food_group_id, store_category_id, density_g_per_ml, heat_level, shelf_life_days, rounding_step)
select i.name, g.id, c.id, i.dens, i.heat, i.shelf, i.rnd
from _ing i join public.food_groups g on g.code = i.fg join public.ingredient_categories c on c.code = i.cat;

insert into public.ingredient_nutrition (ingredient_id, kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, source)
select ing.id, i.kcal, i.p, i.c, i.f, i.fib, i.sug, i.na, 'Valor aproximado de ejemplo (dev)'
from _ing i join public.ingredients ing on ing.name = i.name;

insert into public.ingredient_prices (ingredient_id, region_id, price_per_kg, source_id, observed_on)
select ing.id, r.id, i.price, s.id, date '2026-10-01'
from _ing i join public.ingredients ing on ing.name = i.name
cross join (select id from public.regions where code = 'CO') r
cross join (select id from public.price_sources limit 1) s;
-- Precio propio de Pasto para la papa: permite probar el respaldo por región
insert into public.ingredient_prices (ingredient_id, region_id, price_per_kg, source_id, observed_on)
select ing.id, r.id, 2200, s.id, date '2026-10-01'
from public.ingredients ing, public.regions r, public.price_sources s
where ing.name = 'Papa' and r.code = 'CO-NAR-PASTO' and s.name like 'Datos de ejemplo%';

-- Peso de unidades contables (g)
insert into public.ingredient_unit_weights (ingredient_id, unit_id, grams)
select ing.id, u.id, w.g
from (values ('Ajo','clove',4), ('Limón','unit',60), ('Banano','unit',120), ('Zanahoria','unit',80),
             ('Cebolla cabezona','unit',150), ('Papa','unit',150), ('Ají picante','unit',15),
             ('Huevo','unit',50), ('Sal','pinch',0.4)) w(ing, unit, g)
join public.ingredients ing on ing.name = w.ing join public.units u on u.code = w.unit;

-- Alérgenos
insert into public.ingredient_allergens (ingredient_id, allergen_id)
select ing.id, a.id
from (values ('Avena en hojuelas','gluten'), ('Leche entera','milk'), ('Almendras','tree_nuts'),
             ('Maní','peanuts'), ('Huevo','egg')) v(ing, al)
join public.ingredients ing on ing.name = v.ing join public.allergens a on a.code = v.al;

-- Alérgenos revisados (dev): sin esta marca ninguna receta se publica (R3)
update public.ingredients set allergens_reviewed_at = now();

-- Sustitutos
insert into public.ingredient_substitutions (ingredient_id, substitute_id, ratio, note)
select a.id, b.id, v.r, v.n
from (values ('Almendras','Maní',1,'Cambia el alérgeno'), ('Leche entera','Avena en hojuelas',0.25,'Solo en preparaciones espesas (ejemplo)'),
             ('Pechuga de pollo','Garbanzos cocidos',1.5,'Opción vegetariana')) v(a, b, r, n)
join public.ingredients a on a.name = v.a join public.ingredients b on b.name = v.b;

-- ---------------------------------------------------------------------
-- Recetas oficiales (autor nulo). Se crean en borrador, se les agrega todo,
-- se revisan y SOLO ENTONCES se publican (así se ejercitan las reglas).
-- ---------------------------------------------------------------------
create temp table _rec (title text, descr text, cuisine text, protein text, servings int, prep int, cook int,
                        diff int, keeps int, notes text, slots text[]);
insert into _rec values
 ('Bowl de garbanzos y espinaca','Garbanzos salteados con espinaca, ajo y limón.','mediterranean','legumes',2,10,10,1,null,null,'{lunch,dinner}'),
 ('Avena con banano y almendras','Avena cocida en leche con banano y almendras.','international','dairy',2,5,8,1,null,null,'{breakfast}'),
 ('Sopa de lentejas','Sopa espesa de lentejas con verduras.','colombian','legumes',4,15,40,1,4,'Refrigerada en recipiente cerrado.','{lunch,dinner}'),
 ('Pollo con arroz y brócoli','Pechuga salteada con arroz y brócoli, ají opcional.','international','chicken',4,15,25,2,3,'Refrigerar separado del arroz.','{lunch,dinner}'),
 ('Batido de banano y maní','Batido cremoso de banano, leche y maní.','international','dairy',2,5,0,1,null,null,'{breakfast,snack}'),
 ('Huevos revueltos con espinaca','Huevos revueltos con espinaca fresca.','international','egg',2,5,5,1,null,null,'{breakfast,dinner}');

insert into public.recipes (title, description, cuisine_id, main_protein_id, base_servings, prep_minutes, cook_minutes, difficulty, keeps_days, storage_notes)
select r.title, r.descr, c.id, p.id, r.servings, r.prep, r.cook, r.diff, r.keeps, r.notes
from _rec r join public.cuisines c on c.code = r.cuisine join public.protein_sources p on p.code = r.protein;

insert into public.recipe_meal_slots (recipe_id, slot)
select rc.id, s::public.meal_slot from _rec r join public.recipes rc on rc.title = r.title, unnest(r.slots) s;

-- título, ingrediente, cantidad, unidad, opcional, exponente
insert into public.recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id, is_optional, scaling_exponent, sort_order)
select rc.id, ing.id, v.q, u.id, v.opt, v.ex, row_number() over (partition by v.rec order by v.ord)
from (values
 ('Bowl de garbanzos y espinaca','Garbanzos cocidos',300,'g',false,1.0,1), ('Bowl de garbanzos y espinaca','Espinaca',120,'g',false,1.0,2),
 ('Bowl de garbanzos y espinaca','Ajo',2,'clove',false,1.0,3), ('Bowl de garbanzos y espinaca','Aceite de oliva',2,'tbsp',false,0.8,4),
 ('Bowl de garbanzos y espinaca','Limón',1,'unit',false,1.0,5), ('Bowl de garbanzos y espinaca','Comino molido',1,'tsp',false,0.7,6),
 ('Bowl de garbanzos y espinaca','Sal',0.5,'tsp',false,0.7,7),
 ('Avena con banano y almendras','Avena en hojuelas',80,'g',false,1.0,1), ('Avena con banano y almendras','Leche entera',300,'ml',false,1.0,2),
 ('Avena con banano y almendras','Banano',1,'unit',false,1.0,3), ('Avena con banano y almendras','Almendras',20,'g',true,1.0,4),
 ('Sopa de lentejas','Lentejas secas',200,'g',false,1.0,1), ('Sopa de lentejas','Zanahoria',2,'unit',false,1.0,2),
 ('Sopa de lentejas','Cebolla cabezona',1,'unit',false,1.0,3), ('Sopa de lentejas','Papa',2,'unit',false,1.0,4),
 ('Sopa de lentejas','Ajo',2,'clove',false,1.0,5), ('Sopa de lentejas','Aceite de oliva',1,'tbsp',false,0.8,6),
 ('Sopa de lentejas','Comino molido',0.5,'tsp',false,0.7,7), ('Sopa de lentejas','Sal',1,'tsp',false,0.7,8),
 ('Sopa de lentejas','Cilantro',10,'g',true,0.7,9),
 ('Pollo con arroz y brócoli','Pechuga de pollo',400,'g',false,1.0,1), ('Pollo con arroz y brócoli','Arroz blanco',200,'g',false,1.0,2),
 ('Pollo con arroz y brócoli','Brócoli',200,'g',false,1.0,3), ('Pollo con arroz y brócoli','Ajo',2,'clove',false,1.0,4),
 ('Pollo con arroz y brócoli','Aceite de oliva',1,'tbsp',false,0.8,5), ('Pollo con arroz y brócoli','Ají picante',1,'unit',true,0.7,6),
 ('Pollo con arroz y brócoli','Sal',1,'tsp',false,0.7,7),
 ('Batido de banano y maní','Banano',2,'unit',false,1.0,1), ('Batido de banano y maní','Leche entera',300,'ml',false,1.0,2),
 ('Batido de banano y maní','Maní',30,'g',false,1.0,3),
 ('Huevos revueltos con espinaca','Huevo',4,'unit',false,1.0,1), ('Huevos revueltos con espinaca','Espinaca',60,'g',false,1.0,2),
 ('Huevos revueltos con espinaca','Aceite de oliva',1,'tbsp',false,0.8,3), ('Huevos revueltos con espinaca','Sal',2,'pinch',false,0.7,4)
) v(rec, ing, q, unit, opt, ex, ord)
join public.recipes rc on rc.title = v.rec
join public.ingredients ing on ing.name = v.ing
join public.units u on u.code = v.unit;

insert into public.recipe_steps (recipe_id, step_number, instruction, timer_seconds)
select rc.id, v.n, v.t, v.s
from (values
 ('Bowl de garbanzos y espinaca',1,'Calienta el aceite y sofríe el ajo picado 1 minuto.',60),
 ('Bowl de garbanzos y espinaca',2,'Agrega garbanzos y comino; saltea 5 minutos.',300),
 ('Bowl de garbanzos y espinaca',3,'Añade la espinaca hasta que se marchite, sazona y sirve con limón.',null),
 ('Avena con banano y almendras',1,'Cocina la avena en la leche a fuego medio, revolviendo.',480),
 ('Avena con banano y almendras',2,'Sirve con banano en rodajas y almendras.',null),
 ('Sopa de lentejas',1,'Sofríe cebolla y ajo en el aceite.',300),
 ('Sopa de lentejas',2,'Agrega lentejas lavadas, zanahoria, papa, comino y agua; cocina 35 minutos.',2100),
 ('Sopa de lentejas',3,'Rectifica la sal y termina con cilantro.',null),
 ('Pollo con arroz y brócoli',1,'Cocina el arroz según el paquete.',1200),
 ('Pollo con arroz y brócoli',2,'Saltea el pollo en cubos con ajo hasta dorar.',600),
 ('Pollo con arroz y brócoli',3,'Agrega el brócoli y el ají; cocina 5 minutos y sirve sobre el arroz.',300),
 ('Batido de banano y maní',1,'Licúa todo hasta que quede cremoso.',null),
 ('Huevos revueltos con espinaca',1,'Saltea la espinaca en el aceite 1 minuto.',60),
 ('Huevos revueltos con espinaca',2,'Agrega los huevos batidos y revuelve hasta cuajar.',180)
) v(rec, n, t, s) join public.recipes rc on rc.title = v.rec;

insert into public.recipe_diet_tags (recipe_id, diet_id)
select rc.id, d.id from public.recipes rc, public.diets d
where rc.title in ('Bowl de garbanzos y espinaca','Sopa de lentejas') and d.code = 'low_glycemic';

-- Revisión nutricional (ficticia, solo dev) y publicación
insert into public.nutritionist_reviews (recipe_id, reviewer_name, reviewer_license, outcome, notes)
select id, 'Nutricionista de ejemplo (dev)', 'N/A', 'approved', 'Revisión ficticia de desarrollo' from public.recipes;

update public.recipes set status = 'published';
drop table _ing; drop table _rec;
