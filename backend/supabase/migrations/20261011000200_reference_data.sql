-- =============================================================================
-- 0002 · Tablas de referencia (catálogos pequeños, de solo lectura para la app)
-- Se cargan en la migración (no en seed.sql) porque producción también los necesita.
-- =============================================================================

-- ---- Geografía y moneda -----------------------------------------------------
create table public.countries (
  code          char(2)  primary key,                 -- ISO 3166-1 alfa-2
  name          text     not null,
  currency_code char(3)  not null                     -- ISO 4217
);
comment on table public.countries is 'País y su moneda. La moneda depende del país, no de la región (3FN).';

create table public.regions (
  id           smallint generated always as identity primary key,
  code         text     not null unique,
  name         text     not null,
  country_code char(2)  not null references public.countries(code),
  parent_id    smallint references public.regions(id),
  check (parent_id is null or parent_id <> id)
);
create index regions_parent_idx on public.regions(parent_id);
comment on table public.regions is 'Jerarquía país > departamento > ciudad. Los precios caen al padre cuando no hay precio local.';

-- ---- Alimentación -----------------------------------------------------------
create table public.food_groups (
  id   smallint generated always as identity primary key,
  code text not null unique,
  name text not null
);
comment on table public.food_groups is 'Grupo alimentario (carnes, lácteos, legumbres...). Base para derivar dietas vegetarianas, veganas, etc.';

create table public.ingredient_categories (
  id         smallint generated always as identity primary key,
  code       text     not null unique,
  name       text     not null,
  sort_order smallint not null
);
comment on table public.ingredient_categories is 'Sección del supermercado (verdulería, lácteos...). Distinta de food_groups: una sirve a la compra, la otra a las dietas.';

create table public.allergens (
  id   smallint generated always as identity primary key,
  code text not null unique,
  name text not null
);

create table public.diets (
  id          smallint generated always as identity primary key,
  code        text       not null unique,
  name        text       not null,
  kind        public.diet_kind not null,
  description text,
  unique (id, kind)                                   -- habilita la FK compuesta de recipe_diet_tags
);
comment on column public.diets.kind is
  'rule_based: compatibilidad DERIVADA de ingredientes (grupos/alérgenos excluidos). curated: etiqueta asignada por nutricionista.';

create table public.diet_excluded_food_groups (
  diet_id       smallint not null references public.diets(id)       on delete cascade,
  food_group_id smallint not null references public.food_groups(id) on delete cascade,
  primary key (diet_id, food_group_id)
);
create table public.diet_excluded_allergens (
  diet_id     smallint not null references public.diets(id)     on delete cascade,
  allergen_id smallint not null references public.allergens(id) on delete cascade,
  primary key (diet_id, allergen_id)
);

create table public.cuisines (
  id   smallint generated always as identity primary key,
  code text not null unique,
  name text not null
);
create table public.protein_sources (
  id   smallint generated always as identity primary key,
  code text not null unique,
  name text not null
);
comment on table public.protein_sources is 'Proteína principal de una receta; permite la regla de no repetirla en comidas consecutivas.';

create table public.units (
  id            smallint generated always as identity primary key,
  code          text not null unique,
  name          text not null,
  dimension     public.units_dimension not null,
  factor        numeric(10,4) not null check (factor > 0),
  rounding_step numeric(6,3)  not null check (rounding_step > 0),
  unique (id, dimension)
);
comment on column public.units.factor is
  'mass: gramos por unidad. volume: mililitros por unidad. count: siempre 1 (el peso sale de ingredient_unit_weights).';
comment on column public.units.rounding_step is 'Redondeo práctico al escalar (ej. 0.25 tazas, 0.5 unidades).';

create table public.medical_conditions (
  id   smallint generated always as identity primary key,
  code text not null unique,
  name text not null
);

create table public.recommendation_reasons (
  code        text primary key,
  description text not null
);
comment on table public.recommendation_reasons is 'Motivos tipificados ("sugerida porque tu cilantro vence"). El texto final se arma en la app con plantilla i18n.';

create table public.rating_tags (
  id   smallint generated always as identity primary key,
  code text not null unique,
  name text not null
);

-- ---- Documentos legales -----------------------------------------------------
create table public.legal_documents (
  id           smallint generated always as identity primary key,
  kind         public.legal_doc_kind not null,
  version      smallint not null check (version > 0),
  published_at timestamptz not null default now(),
  content_url  text,
  unique (kind, version)
);
comment on table public.legal_documents is 'Versiones publicadas de cada documento legal. Los textos los redacta y valida un abogado.';

-- ============================== DATOS ========================================
insert into public.countries (code, name, currency_code) values ('CO', 'Colombia', 'COP');

insert into public.regions (code, name, country_code, parent_id) values ('CO', 'Colombia', 'CO', null);
insert into public.regions (code, name, country_code, parent_id)
  select 'CO-NAR', 'Nariño', 'CO', id from public.regions where code = 'CO';
insert into public.regions (code, name, country_code, parent_id)
  select 'CO-NAR-PASTO', 'Pasto', 'CO', id from public.regions where code = 'CO-NAR';

insert into public.food_groups (code, name) values
  ('red_meat','Carnes rojas'), ('poultry','Aves'), ('fish','Pescados'), ('shellfish','Mariscos'),
  ('dairy','Lácteos'), ('egg','Huevos'), ('honey','Miel'),
  ('legumes','Legumbres'), ('grains','Cereales y derivados'), ('vegetables','Verduras'),
  ('fruits','Frutas'), ('nuts_seeds','Frutos secos y semillas'), ('fats_oils','Grasas y aceites'),
  ('herbs_spices','Hierbas y especias'), ('tubers','Tubérculos'), ('other','Otros');

insert into public.ingredient_categories (code, name, sort_order) values
  ('produce','Verdulería y frutas',1), ('meat_fish','Carnes y pescados',2), ('dairy_eggs','Lácteos y huevos',3),
  ('bakery','Panadería',4), ('pantry','Despensa',5), ('frozen','Congelados',6),
  ('spices_condiments','Especias y condimentos',7), ('other','Otros',8);

insert into public.allergens (code, name) values
  ('tree_nuts','Frutos secos'), ('peanuts','Maní'), ('shellfish','Mariscos'), ('fish','Pescado'),
  ('egg','Huevo'), ('milk','Leche'), ('soy','Soja'), ('gluten','Gluten'), ('sesame','Sésamo');

insert into public.diets (code, name, kind, description) values
  ('vegetarian','Vegetariano','rule_based','Sin carnes, aves, pescados ni mariscos'),
  ('vegan','Vegano','rule_based','Sin ningún producto de origen animal'),
  ('pescatarian','Pescetariano','rule_based','Sin carnes ni aves'),
  ('gluten_free','Sin gluten','rule_based','Sin ingredientes con gluten'),
  ('lactose_free','Sin lactosa','rule_based','Sin lácteos'),
  ('keto','Keto','curated','Etiqueta revisada por nutricionista'),
  ('low_sodium','Bajo en sodio','curated','Etiqueta revisada por nutricionista'),
  ('low_glycemic','Bajo índice glucémico','curated','Etiqueta revisada por nutricionista'),
  ('low_fodmap','Baja en FODMAP','curated','Etiqueta revisada por nutricionista'),
  ('halal','Halal','curated','Requiere certificación; no se puede derivar de ingredientes'),
  ('kosher','Kosher','curated','Requiere certificación; no se puede derivar de ingredientes');

insert into public.diet_excluded_food_groups (diet_id, food_group_id)
select d.id, g.id from public.diets d join public.food_groups g on
     (d.code = 'vegetarian'   and g.code in ('red_meat','poultry','fish','shellfish'))
  or (d.code = 'vegan'        and g.code in ('red_meat','poultry','fish','shellfish','dairy','egg','honey'))
  or (d.code = 'pescatarian'  and g.code in ('red_meat','poultry'))
  or (d.code = 'lactose_free' and g.code in ('dairy'));

insert into public.diet_excluded_allergens (diet_id, allergen_id)
select d.id, a.id from public.diets d join public.allergens a on d.code = 'gluten_free' and a.code = 'gluten';

insert into public.cuisines (code, name) values
  ('mediterranean','Mediterránea'), ('asian','Asiática'), ('mexican','Mexicana'),
  ('andean','Andina'), ('italian','Italiana'), ('colombian','Colombiana'), ('international','Internacional');

insert into public.protein_sources (code, name) values
  ('chicken','Pollo'), ('beef','Res'), ('pork','Cerdo'), ('fish','Pescado'), ('seafood','Mariscos'),
  ('egg','Huevo'), ('legumes','Legumbres'), ('tofu','Tofu y soja'), ('dairy','Lácteos');

insert into public.units (code, name, dimension, factor, rounding_step) values
  ('g','gramo','mass',1,1),            ('kg','kilogramo','mass',1000,0.05),
  ('ml','mililitro','volume',1,5),     ('l','litro','volume',1000,0.05),
  ('cup','taza (240 ml)','volume',240,0.25),
  ('tbsp','cucharada (15 ml)','volume',15,0.5),
  ('tsp','cucharadita (5 ml)','volume',5,0.25),
  ('unit','unidad','count',1,0.5),
  ('clove','diente','count',1,1),
  ('handful','puñado','count',1,0.5),
  ('pinch','pizca','count',1,1);

insert into public.medical_conditions (code, name) values
  ('diabetes','Diabetes'), ('hypertension','Hipertensión'), ('celiac_disease','Enfermedad celíaca'),
  ('lactose_intolerance','Intolerancia a la lactosa'), ('high_cholesterol','Colesterol alto');

insert into public.recommendation_reasons (code, description) values
  ('pantry_expiring','Usa un ingrediente de la despensa próximo a vencer'),
  ('pantry_match','Usa varios ingredientes que ya tienes'),
  ('high_rating','Bien calificada por ti o por la comunidad'),
  ('budget_friendly','Ayuda a ajustarse al presupuesto'),
  ('variety','Aporta variedad frente a tus últimas comidas'),
  ('cuisine_favorite','Pertenece a una de tus cocinas favoritas'),
  ('macro_fit','Se ajusta a tu objetivo de macronutrientes'),
  ('quick','Cabe en tu tiempo máximo de cocina'),
  ('user_request','La pediste tú (asistente o cambio manual)');

insert into public.rating_tags (code, name) values
  ('too_salty','Muy salado'), ('took_longer','Tardó más de lo esperado'), ('bad_taste','No me gustó el sabor'),
  ('too_spicy','Muy picante'), ('loved_repeat','Me encantó, repetir'), ('hard_ingredients','Ingredientes difíciles de conseguir');

-- Versión 1 de cada documento. content_url queda vacío: los textos los redacta un abogado.
insert into public.legal_documents (kind, version) values
  ('privacy_policy',1), ('terms',1), ('health_disclaimer',1), ('community_sharing',1);
