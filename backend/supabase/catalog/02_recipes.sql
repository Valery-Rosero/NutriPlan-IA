-- =============================================================================
-- Catálogo real · 02 · Recetas versátiles colombianas (ADR-020)
-- Cada receta: base fija + grupos intercambiables que se resuelven con la despensa de la familia.
-- Revisión: asistida por IA, pendiente de validación profesional (ADR-021).
-- Idempotente: una receta cuyo id ya existe no se toca. Para cambiar una publicada,
-- pásala a borrador, edítala y vuelve a publicarla (las reglas de publicación aplican igual).
-- Formato: base = [ingrediente, cantidad, unidad, opcional?, exponente?]
--          groups = [{label, min, max, options: [[ingrediente, cantidad, unidad, por_defecto?]]}]
-- =============================================================================

create or replace function pg_temp.ing(p_name text) returns uuid language plpgsql as $$
declare v uuid;
begin
  select id into v from public.ingredients where lower(name) = lower(p_name);
  if v is null then raise exception 'catálogo: ingrediente desconocido "%"', p_name; end if;
  return v;
end $$;

create or replace function pg_temp.unit(p_code text) returns smallint language plpgsql as $$
declare v smallint;
begin
  select id into v from public.units where code = p_code;
  if v is null then raise exception 'catálogo: unidad desconocida "%"', p_code; end if;
  return v;
end $$;

create or replace function pg_temp.load_recipe(r jsonb) returns void language plpgsql as $$
declare
  v_id uuid := (r ->> 'id')::uuid;
  l jsonb; g jsonb; o jsonb;
  i int := 0; k int := 0;
begin
  if exists (select 1 from public.recipes where id = v_id) then return; end if;

  insert into public.recipes (id, title, description, cuisine_id, base_servings, prep_minutes, cook_minutes,
                              difficulty, keeps_days, storage_notes)
  values (v_id, r ->> 'title', r ->> 'description', (select id from public.cuisines where code = 'colombian'),
          (r ->> 'servings')::smallint, (r ->> 'prep')::smallint, (r ->> 'cook')::smallint,
          coalesce((r ->> 'difficulty')::smallint, 1), (r ->> 'keeps')::smallint,
          case when r ? 'keeps' then 'Refrigerado en recipiente cerrado.' end);

  insert into public.recipe_meal_slots (recipe_id, slot)
  select v_id, s::public.meal_slot from jsonb_array_elements_text(r -> 'slots') s;

  for l in select x from jsonb_array_elements(coalesce(r -> 'base', '[]'::jsonb)) x loop
    i := i + 1;
    insert into public.recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id, is_optional, scaling_exponent, sort_order)
    values (v_id, pg_temp.ing(l ->> 0), (l ->> 1)::numeric, pg_temp.unit(l ->> 2),
            coalesce((l ->> 3)::boolean, false), coalesce((l ->> 4)::numeric, 1), i);
  end loop;

  for g in select x from jsonb_array_elements(coalesce(r -> 'groups', '[]'::jsonb)) x loop
    k := k + 1;
    insert into public.recipe_flex_groups (recipe_id, group_key, label, min_choices, max_choices, sort_order)
    values (v_id, k, g ->> 'label', (g ->> 'min')::smallint, (g ->> 'max')::smallint, k);
    for o in select x from jsonb_array_elements(g -> 'options') x loop
      insert into public.recipe_flex_options (recipe_id, group_key, ingredient_id, quantity, unit_id, is_default)
      values (v_id, k, pg_temp.ing(o ->> 0), (o ->> 1)::numeric, pg_temp.unit(o ->> 2), coalesce((o ->> 3)::boolean, false));
    end loop;
  end loop;

  insert into public.recipe_steps (recipe_id, step_number, instruction)
  select v_id, t.ord, t.s from jsonb_array_elements_text(r -> 'steps') with ordinality t(s, ord);

  insert into public.nutritionist_reviews (recipe_id, reviewer_name, outcome, notes)
  values (v_id, 'Revisión asistida por IA (Claude) – pendiente de validación profesional', 'approved',
          'ADR-021: catálogo del piloto. Debe revisarlo un nutricionista titulado antes de abrir al público.');

  update public.recipes set status = 'published' where id = v_id;   -- aplica todas las reglas de publicación
end $$;

select pg_temp.load_recipe(x) from jsonb_array_elements($catalog$[
{
  "id": "6f1c0000-0000-4000-8000-000000000001",
  "title": "Calentado con lo que haya",
  "description": "Arroz y fríjoles con hogao, la proteína que tengas y un buen acompañante.",
  "slots": ["breakfast", "lunch", "dinner"], "servings": 4, "prep": 10, "cook": 15,
  "base": [["Arroz blanco", 150, "g"], ["Fríjol cocido", 250, "g"], ["Cebolla larga", 2, "unit"], ["Tomate", 1, "unit"],
           ["Aceite vegetal", 1, "tbsp", false, 0.8], ["Sal", 0.5, "tsp", false, 0.7]],
  "groups": [
    {"label": "Proteína", "min": 1, "max": 1, "options": [["Huevo", 4, "unit", true], ["Carne de res molida", 250, "g"], ["Pechuga de pollo", 250, "g"], ["Queso campesino", 150, "g"]]},
    {"label": "Acompañante", "min": 0, "max": 1, "options": [["Aguacate", 1, "unit"], ["Plátano maduro", 1, "unit"], ["Arepa de maíz", 2, "unit"]]}
  ],
  "steps": ["Si no tienes arroz cocido de ayer, cocínalo primero con un poco de sal.",
            "Pica la cebolla larga y el tomate y sofríelos en el aceite 3 minutos: ese es el hogao.",
            "Agrega el arroz cocido y los fríjoles; revuelve a fuego medio 5 minutos hasta que todo esté caliente.",
            "Prepara la proteína que elegiste: huevo frito o revuelto, carne o pollo salteados, o queso en cubos.",
            "Sirve con el acompañante que tengas a mano."]
},
{
  "id": "6f1c0000-0000-4000-8000-000000000002",
  "title": "Huevos pericos con lo que tengas",
  "description": "El desayuno de siempre: huevo con tomate y cebolla, más lo que haya en la nevera.",
  "slots": ["breakfast", "dinner"], "servings": 4, "prep": 5, "cook": 10,
  "base": [["Huevo", 6, "unit"], ["Tomate", 2, "unit"], ["Cebolla larga", 2, "unit"],
           ["Aceite vegetal", 1, "tbsp", false, 0.8], ["Sal", 2, "pinch", false, 0.7]],
  "groups": [
    {"label": "Para agregar", "min": 0, "max": 2, "options": [["Espinaca", 60, "g"], ["Pimentón", 70, "g"], ["Champiñones", 100, "g"], ["Queso campesino", 80, "g"]]},
    {"label": "Para acompañar", "min": 1, "max": 1, "options": [["Arepa de maíz", 4, "unit", true], ["Pan blanco", 4, "unit"], ["Plátano maduro", 1, "unit"]]}
  ],
  "steps": ["Pica el tomate y la cebolla larga y sofríelos en el aceite 3 minutos.",
            "Si vas a agregar verduras o queso, ponlas ahora y cocina 2 minutos más.",
            "Bate los huevos con la sal, viértelos y revuelve a fuego bajo hasta que cuajen.",
            "Sirve con el acompañante caliente."]
},
{
  "id": "6f1c0000-0000-4000-8000-000000000003",
  "title": "Arroz salteado con lo que tengas",
  "description": "Un arroz completo con la proteína y las verduras que haya en casa.",
  "slots": ["lunch", "dinner"], "servings": 4, "prep": 15, "cook": 25, "keeps": 3,
  "base": [["Arroz blanco", 300, "g"], ["Ajo", 3, "clove"], ["Cebolla cabezona", 1, "unit"],
           ["Aceite vegetal", 2, "tbsp", false, 0.8], ["Sal", 1, "tsp", false, 0.7]],
  "groups": [
    {"label": "Proteína", "min": 1, "max": 1, "options": [["Pechuga de pollo", 400, "g", true], ["Cerdo", 400, "g"], ["Carne de res molida", 400, "g"], ["Huevo", 4, "unit"], ["Fríjol cocido", 400, "g"], ["Atún en lata", 2, "unit"]]},
    {"label": "Verduras", "min": 1, "max": 3, "options": [["Zanahoria", 250, "g", true], ["Habichuela", 250, "g"], ["Arveja verde", 250, "g"], ["Pimentón", 250, "g"], ["Mazorca", 250, "g"], ["Brócoli", 250, "g"], ["Repollo", 250, "g"]]}
  ],
  "steps": ["Cocina el arroz con la mitad de la sal y el doble de agua, unos 20 minutos.",
            "Pica el ajo, la cebolla y las verduras que elegiste en trozos pequeños.",
            "Saltea la proteína en cubos con la mitad del aceite hasta dorar (el huevo, revuelto; el atún, solo calentarlo).",
            "En la misma olla saltea la cebolla, el ajo y las verduras 5 minutos.",
            "Mezcla todo con el arroz, rectifica la sal y sirve."]
},
{
  "id": "6f1c0000-0000-4000-8000-000000000004",
  "title": "Sopa de verduras del día",
  "description": "Sopa casera con las verduras que haya, y proteína si tienes.",
  "slots": ["lunch", "dinner"], "servings": 6, "prep": 15, "cook": 35, "keeps": 3,
  "base": [["Papa", 3, "unit"], ["Cebolla larga", 2, "unit"], ["Ajo", 2, "clove"], ["Agua", 2, "l"],
           ["Aceite vegetal", 1, "tbsp", false, 0.8], ["Sal", 1, "tsp", false, 0.7], ["Cilantro", 10, "g", true, 0.7]],
  "groups": [
    {"label": "Verduras", "min": 2, "max": 4, "options": [["Ahuyama", 250, "g", true], ["Zanahoria", 200, "g"], ["Habichuela", 200, "g"], ["Arveja verde", 200, "g"], ["Mazorca", 200, "g"], ["Repollo", 200, "g"], ["Espinaca", 100, "g"], ["Brócoli", 200, "g"]]},
    {"label": "Proteína (si tienes)", "min": 0, "max": 1, "options": [["Pechuga de pollo", 300, "g"], ["Carne de res para sudar", 300, "g"], ["Huevo", 4, "unit"], ["Fríjol cocido", 300, "g"], ["Lentejas secas", 150, "g"]]}
  ],
  "steps": ["Sofríe la cebolla larga y el ajo picados en el aceite 3 minutos.",
            "Agrega el agua, la papa en cubos y la proteína (si es carne o lentejas, desde el principio).",
            "Cuando hierva, agrega las verduras más duras (ahuyama, zanahoria, mazorca) y luego las tiernas.",
            "Cocina 25 a 30 minutos a fuego medio. Si usas huevo, agrégalo batido al final revolviendo.",
            "Rectifica la sal y sirve con cilantro picado."]
},
{
  "id": "6f1c0000-0000-4000-8000-000000000005",
  "title": "Sudado de lo que haya",
  "description": "Guiso de tomate y papa con la proteína que tengas, como en casa.",
  "slots": ["lunch", "dinner"], "servings": 4, "prep": 15, "cook": 40, "difficulty": 2, "keeps": 3,
  "base": [["Tomate", 3, "unit"], ["Cebolla cabezona", 1, "unit"], ["Ajo", 3, "clove"], ["Papa", 4, "unit"], ["Agua", 500, "ml"],
           ["Comino molido", 0.5, "tsp", false, 0.7], ["Aceite vegetal", 1, "tbsp", false, 0.8], ["Sal", 1, "tsp", false, 0.7]],
  "groups": [
    {"label": "Proteína", "min": 1, "max": 1, "options": [["Muslo de pollo", 600, "g", true], ["Pechuga de pollo", 500, "g"], ["Carne de res para sudar", 500, "g"], ["Cerdo", 500, "g"], ["Garbanzos cocidos", 500, "g"]]},
    {"label": "Acompañante", "min": 0, "max": 1, "options": [["Arroz blanco", 250, "g"], ["Yuca", 400, "g"], ["Plátano verde", 1, "unit"]]}
  ],
  "steps": ["Licúa o pica muy fino el tomate, la cebolla y el ajo.",
            "Dora la proteína en el aceite con la sal y el comino.",
            "Agrega la salsa de tomate y el agua; tapa y cocina 15 minutos.",
            "Agrega la papa en trozos y cocina tapado 20 minutos más, hasta que esté blanda.",
            "Sirve con el acompañante que tengas."]
},
{
  "id": "6f1c0000-0000-4000-8000-000000000006",
  "title": "Tortilla de papa con lo que sobre",
  "description": "Tortilla gruesa de huevo y papa para aprovechar lo que quedó en la nevera.",
  "slots": ["breakfast", "lunch", "dinner"], "servings": 4, "prep": 10, "cook": 25,
  "base": [["Huevo", 6, "unit"], ["Papa", 3, "unit"], ["Cebolla cabezona", 1, "unit"],
           ["Aceite vegetal", 3, "tbsp", false, 0.8], ["Sal", 1, "tsp", false, 0.7]],
  "groups": [
    {"label": "Para agregar", "min": 0, "max": 2, "options": [["Espinaca", 80, "g"], ["Pimentón", 100, "g"], ["Champiñones", 100, "g"], ["Queso campesino", 100, "g"], ["Atún en lata", 1, "unit"]]}
  ],
  "steps": ["Corta la papa en láminas finas y la cebolla en tiras; fríelas en el aceite a fuego medio 12 minutos.",
            "Agrega lo que vayas a aprovechar y cocina 2 minutos.",
            "Bate los huevos con la sal, mezcla con la papa y vierte en la sartén.",
            "Cocina tapado a fuego bajo 8 minutos, voltea con un plato y dora 3 minutos más."]
},
{
  "id": "6f1c0000-0000-4000-8000-000000000007",
  "title": "Arepa rellena a tu gusto",
  "description": "Arepa asada rellena con lo que haya: queso, huevo, pollo, carne o fríjol.",
  "slots": ["breakfast", "dinner", "snack"], "servings": 4, "prep": 10, "cook": 15,
  "base": [["Arepa de maíz", 4, "unit"], ["Aceite vegetal", 1, "tsp", false, 0.8]],
  "groups": [
    {"label": "Relleno", "min": 1, "max": 2, "options": [["Queso campesino", 150, "g", true], ["Huevo", 4, "unit"], ["Pechuga de pollo", 200, "g"], ["Carne de res molida", 200, "g"], ["Fríjol cocido", 200, "g"], ["Aguacate", 1, "unit"]]},
    {"label": "Para darle sabor", "min": 0, "max": 2, "options": [["Tomate", 1, "unit"], ["Cebolla larga", 1, "unit"], ["Champiñones", 100, "g"]]}
  ],
  "steps": ["Asa las arepas en una sartén con unas gotas de aceite, 4 minutos por lado.",
            "Prepara el relleno: pollo o carne salteados, huevo revuelto, fríjoles calientes o queso rallado.",
            "Abre las arepas por un costado y rellénalas; si tienes tomate o cebolla, agrégalos picados."]
},
{
  "id": "6f1c0000-0000-4000-8000-000000000008",
  "title": "Lentejas guisadas con lo que haya",
  "description": "Lentejas rendidoras con la verdura que tengas; buenas para varios días.",
  "slots": ["lunch", "dinner"], "servings": 6, "prep": 10, "cook": 40, "keeps": 4,
  "base": [["Lentejas secas", 300, "g"], ["Tomate", 2, "unit"], ["Cebolla cabezona", 1, "unit"], ["Ajo", 2, "clove"], ["Agua", 1500, "ml"],
           ["Comino molido", 0.5, "tsp", false, 0.7], ["Aceite vegetal", 1, "tbsp", false, 0.8], ["Sal", 1, "tsp", false, 0.7]],
  "groups": [
    {"label": "Verduras", "min": 1, "max": 2, "options": [["Zanahoria", 150, "g", true], ["Papa", 2, "unit"], ["Ahuyama", 200, "g"], ["Plátano maduro", 1, "unit"], ["Espinaca", 100, "g"]]},
    {"label": "Proteína extra (si tienes)", "min": 0, "max": 1, "options": [["Cerdo", 250, "g"], ["Huevo", 3, "unit"]]}
  ],
  "steps": ["Lava las lentejas y ponlas a cocinar en el agua.",
            "Mientras, sofríe la cebolla, el ajo y el tomate picados con el comino y la sal (hogao).",
            "A los 15 minutos agrega el hogao, las verduras en cubos y el cerdo si lo usas.",
            "Cocina 25 minutos más hasta que espesen. Si usas huevo, sírvelo cocido encima."]
},
{
  "id": "6f1c0000-0000-4000-8000-000000000009",
  "title": "Fríjoles con lo que haya",
  "description": "Fríjoles con plátano y zanahoria; con carne o sin ella, siempre rinden.",
  "slots": ["lunch", "dinner"], "servings": 6, "prep": 15, "cook": 90, "difficulty": 2, "keeps": 4,
  "base": [["Fríjol rojo seco", 500, "g"], ["Plátano verde", 1, "unit"], ["Zanahoria", 1, "unit"], ["Tomate", 2, "unit"],
           ["Cebolla larga", 2, "unit"], ["Ajo", 2, "clove"], ["Agua", 2500, "ml"],
           ["Comino molido", 0.5, "tsp", false, 0.7], ["Aceite vegetal", 1, "tbsp", false, 0.8], ["Sal", 1.5, "tsp", false, 0.7]],
  "groups": [
    {"label": "Proteína (si tienes)", "min": 0, "max": 1, "options": [["Cerdo", 300, "g"], ["Carne de res molida", 300, "g"]]},
    {"label": "Para acompañar", "min": 0, "max": 2, "options": [["Arroz blanco", 300, "g"], ["Aguacate", 1, "unit"], ["Arepa de maíz", 3, "unit"]]}
  ],
  "steps": ["Deja los fríjoles en remojo la noche anterior y bota esa agua.",
            "Cocínalos en el agua nueva con la carne (si usas) hasta que ablanden: 60 minutos en olla normal o 25 en olla a presión.",
            "Agrega el plátano y la zanahoria picados finos; cocina 20 minutos más.",
            "Sofríe el tomate, la cebolla, el ajo y el comino; agrégalo con la sal y deja espesar 10 minutos.",
            "Sirve con lo que tengas para acompañar."]
},
{
  "id": "6f1c0000-0000-4000-8000-000000000010",
  "title": "Pasta con lo que hay en la nevera",
  "description": "Pasta en salsa de tomate casera con la proteína y verduras disponibles.",
  "slots": ["lunch", "dinner"], "servings": 4, "prep": 10, "cook": 20, "keeps": 2,
  "base": [["Pasta seca", 400, "g"], ["Tomate", 3, "unit"], ["Ajo", 3, "clove"],
           ["Aceite vegetal", 2, "tbsp", false, 0.8], ["Sal", 1, "tsp", false, 0.7]],
  "groups": [
    {"label": "Proteína", "min": 1, "max": 1, "options": [["Pechuga de pollo", 300, "g", true], ["Carne de res molida", 300, "g"], ["Atún en lata", 2, "unit"], ["Garbanzos cocidos", 300, "g"], ["Queso campesino", 150, "g"]]},
    {"label": "Verduras (si tienes)", "min": 0, "max": 2, "options": [["Espinaca", 100, "g"], ["Brócoli", 200, "g"], ["Pimentón", 150, "g"], ["Mazorca", 150, "g"], ["Champiñones", 200, "g"]]}
  ],
  "steps": ["Cocina la pasta en agua con sal según el paquete.",
            "Sofríe el ajo en el aceite, agrega la proteína y cocina hasta que esté lista.",
            "Agrega el tomate picado y las verduras; cocina 8 minutos hasta formar una salsa.",
            "Mezcla con la pasta escurrida y sirve."]
},
{
  "id": "6f1c0000-0000-4000-8000-000000000011",
  "title": "Changua",
  "description": "Caldo de leche con huevo y cebolla larga, para mañanas frías.",
  "slots": ["breakfast"], "servings": 4, "prep": 5, "cook": 15,
  "base": [["Leche entera", 500, "ml"], ["Agua", 500, "ml"], ["Huevo", 4, "unit"], ["Cebolla larga", 1, "unit"],
           ["Cilantro", 10, "g", false, 0.7], ["Sal", 2, "pinch", false, 0.7]],
  "groups": [
    {"label": "Para acompañar", "min": 1, "max": 1, "options": [["Pan blanco", 4, "unit", true], ["Arepa de maíz", 2, "unit"]]}
  ],
  "steps": ["Calienta la leche con el agua, la sal y la cebolla larga picada.",
            "Cuando hierva, baja el fuego y casca los huevos uno a uno; cocina 3 minutos sin revolver.",
            "Sirve con cilantro picado y el pan o la arepa en trozos."]
},
{
  "id": "6f1c0000-0000-4000-8000-000000000012",
  "title": "Ensalada fresca con lo que haya",
  "description": "Ensalada con limón y las verduras disponibles; con proteína se vuelve plato fuerte.",
  "slots": ["lunch", "dinner", "snack"], "servings": 4, "prep": 15, "cook": 0,
  "base": [["Tomate", 2, "unit"], ["Limón", 1, "unit"], ["Aceite vegetal", 2, "tbsp", false, 0.8], ["Sal", 0.5, "tsp", false, 0.7]],
  "groups": [
    {"label": "Verduras", "min": 2, "max": 4, "options": [["Pepino", 200, "g", true], ["Repollo", 200, "g"], ["Zanahoria", 150, "g"], ["Aguacate", 1, "unit"], ["Espinaca", 100, "g"], ["Mazorca", 150, "g"], ["Pimentón", 100, "g"]]},
    {"label": "Proteína (si tienes)", "min": 0, "max": 1, "options": [["Huevo", 3, "unit"], ["Atún en lata", 1, "unit"], ["Garbanzos cocidos", 200, "g"], ["Queso campesino", 100, "g"], ["Pechuga de pollo", 200, "g"]]}
  ],
  "steps": ["Lava bien las verduras y córtalas en trozos pequeños (la mazorca, cocida).",
            "Si usas proteína, cocínala antes: huevo duro 10 minutos, pollo a la plancha.",
            "Mezcla todo con el jugo de limón, el aceite y la sal justo antes de servir."]
},
{
  "id": "6f1c0000-0000-4000-8000-000000000013",
  "title": "Avena con fruta",
  "description": "Avena caliente en leche o agua con la fruta que haya.",
  "slots": ["breakfast", "snack"], "servings": 4, "prep": 2, "cook": 10,
  "base": [["Avena en hojuelas", 160, "g"], ["Sal", 1, "pinch", false, 0.7]],
  "groups": [
    {"label": "Líquido", "min": 1, "max": 1, "options": [["Leche entera", 800, "ml", true], ["Agua", 800, "ml"]]},
    {"label": "Fruta", "min": 1, "max": 2, "options": [["Banano", 2, "unit", true], ["Mango", 1, "unit"], ["Manzana", 1, "unit"], ["Fresa", 200, "g"]]},
    {"label": "Para endulzar (si quieres)", "min": 0, "max": 1, "options": [["Panela", 40, "g"]]}
  ],
  "steps": ["Calienta el líquido con la sal y la panela si la usas.",
            "Agrega la avena y cocina a fuego medio 6 a 8 minutos, revolviendo.",
            "Sirve con la fruta picada encima."]
},
{
  "id": "6f1c0000-0000-4000-8000-000000000014",
  "title": "Patacones con lo que tengas",
  "description": "Patacones crocantes con hogao y lo que haya para ponerles encima.",
  "slots": ["dinner", "snack"], "servings": 4, "prep": 10, "cook": 20,
  "base": [["Plátano verde", 2, "unit"], ["Tomate", 2, "unit"], ["Cebolla larga", 2, "unit"],
           ["Aceite vegetal", 4, "tbsp", false, 0.8], ["Sal", 1, "tsp", false, 0.7]],
  "groups": [
    {"label": "Encima", "min": 1, "max": 2, "options": [["Queso campesino", 150, "g", true], ["Carne de res molida", 200, "g"], ["Pechuga de pollo", 200, "g"], ["Fríjol cocido", 200, "g"], ["Aguacate", 1, "unit"], ["Atún en lata", 1, "unit"]]}
  ],
  "steps": ["Pela los plátanos, córtalos en trozos de 3 cm y fríelos 4 minutos.",
            "Aplánalos con un plato o una tabla y fríelos de nuevo hasta dorar; sálalos.",
            "Sofríe el tomate y la cebolla larga picados para el hogao.",
            "Sirve los patacones con el hogao y lo que elegiste encima."]
},
{
  "id": "6f1c0000-0000-4000-8000-000000000015",
  "title": "Crema de ahuyama",
  "description": "Crema suave de ahuyama; cremosa con leche o queso si hay.",
  "slots": ["lunch", "dinner"], "servings": 4, "prep": 10, "cook": 25, "keeps": 3,
  "base": [["Ahuyama", 600, "g"], ["Cebolla cabezona", 1, "unit"], ["Ajo", 2, "clove"], ["Agua", 750, "ml"],
           ["Aceite vegetal", 1, "tbsp", false, 0.8], ["Sal", 1, "tsp", false, 0.7]],
  "groups": [
    {"label": "Para hacerla cremosa (si tienes)", "min": 0, "max": 1, "options": [["Leche entera", 200, "ml"], ["Queso campesino", 80, "g"]]},
    {"label": "Para acompañar (si tienes)", "min": 0, "max": 1, "options": [["Pan blanco", 4, "unit"], ["Arepa de maíz", 2, "unit"], ["Aguacate", 1, "unit"]]}
  ],
  "steps": ["Sofríe la cebolla y el ajo picados en el aceite 3 minutos.",
            "Agrega la ahuyama en cubos, el agua y la sal; cocina 20 minutos hasta que esté blanda.",
            "Licúa con cuidado (deja salir el vapor); si tienes leche o queso, agrégalo al licuar.",
            "Sirve caliente con el acompañante."]
},
{
  "id": "6f1c0000-0000-4000-8000-000000000016",
  "title": "Batido de fruta",
  "description": "Batido con la fruta que esté madura, en leche o en agua.",
  "slots": ["breakfast", "snack"], "servings": 2, "prep": 5, "cook": 0,
  "groups": [
    {"label": "Líquido", "min": 1, "max": 1, "options": [["Leche entera", 400, "ml", true], ["Agua", 400, "ml"]]},
    {"label": "Fruta", "min": 1, "max": 2, "options": [["Banano", 2, "unit", true], ["Mango", 1, "unit"], ["Fresa", 200, "g"], ["Manzana", 1, "unit"]]},
    {"label": "Para endulzar (si quieres)", "min": 0, "max": 1, "options": [["Panela", 20, "g"]]}
  ],
  "steps": ["Lava y pica la fruta.",
            "Licúa la fruta con el líquido y la panela si la usas, 1 minuto.",
            "Sirve de inmediato."]
}
]$catalog$::jsonb) x;
