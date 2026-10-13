# Modelo de datos (generado desde las migraciones)

> Fuente de verdad: `backend/supabase/migrations/`. Este archivo se generó leyendo la base real después de aplicar las 11 migraciones. Si cambia una migración, regenerar (`03-datos/_generar_modelo.py` (requiere el clúster de pruebas: `backend/supabase/tests/pg.sh`)).

Principios: 3FN; lo derivable no se guarda (alérgenos y dietas de una receta, nutrición por porción, picante y apto-batch); cantidades canónicas en gramos; RLS en todas las tablas; ver `reglas-de-negocio.md`.


## Referencia (catálogos cerrados)


### `countries`

País y su moneda. La moneda depende del país, no de la región (3FN).

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `code` | character(2) | no |  |  |
| `name` | text | no |  |  |
| `currency_code` | character(3) | no |  |  |

Restricciones:
- **PK**: `PRIMARY KEY (code)`

### `regions`

Jerarquía país > departamento > ciudad. Los precios caen al padre cuando no hay precio local.

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | smallint | no |  |  |
| `code` | text | no |  |  |
| `name` | text | no |  |  |
| `country_code` | character(2) | no |  |  |
| `parent_id` | smallint | sí |  |  |

Restricciones:
- **CHECK**: `CHECK (((parent_id IS NULL) OR (parent_id <> id)))`
- **FK**: `FOREIGN KEY (parent_id) REFERENCES regions(id)`
- **FK**: `FOREIGN KEY (country_code) REFERENCES countries(code)`
- **PK**: `PRIMARY KEY (id)`
- **UNIQUE**: `UNIQUE (code)`

### `food_groups`

Grupo alimentario (carnes, lácteos, legumbres...). Base para derivar dietas vegetarianas, veganas, etc.

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | smallint | no |  |  |
| `code` | text | no |  |  |
| `name` | text | no |  |  |

Restricciones:
- **PK**: `PRIMARY KEY (id)`
- **UNIQUE**: `UNIQUE (code)`

### `ingredient_categories`

Sección del supermercado (verdulería, lácteos...). Distinta de food_groups: una sirve a la compra, la otra a las dietas.

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | smallint | no |  |  |
| `code` | text | no |  |  |
| `name` | text | no |  |  |
| `sort_order` | smallint | no |  |  |

Restricciones:
- **PK**: `PRIMARY KEY (id)`
- **UNIQUE**: `UNIQUE (code)`

### `allergens`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | smallint | no |  |  |
| `code` | text | no |  |  |
| `name` | text | no |  |  |

Restricciones:
- **PK**: `PRIMARY KEY (id)`
- **UNIQUE**: `UNIQUE (code)`

### `diets`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | smallint | no |  |  |
| `code` | text | no |  |  |
| `name` | text | no |  |  |
| `kind` | diet_kind | no |  | rule_based: compatibilidad DERIVADA de ingredientes (grupos/alérgenos excluidos). curated: etiqueta asignada por nutricionista. |
| `description` | text | sí |  |  |

Restricciones:
- **PK**: `PRIMARY KEY (id)`
- **UNIQUE**: `UNIQUE (code)`
- **UNIQUE**: `UNIQUE (id, kind)`

### `diet_excluded_food_groups`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `diet_id` | smallint | no |  |  |
| `food_group_id` | smallint | no |  |  |

Restricciones:
- **FK**: `FOREIGN KEY (food_group_id) REFERENCES food_groups(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (diet_id) REFERENCES diets(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (diet_id, food_group_id)`

### `diet_excluded_allergens`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `diet_id` | smallint | no |  |  |
| `allergen_id` | smallint | no |  |  |

Restricciones:
- **FK**: `FOREIGN KEY (allergen_id) REFERENCES allergens(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (diet_id) REFERENCES diets(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (diet_id, allergen_id)`

### `cuisines`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | smallint | no |  |  |
| `code` | text | no |  |  |
| `name` | text | no |  |  |

Restricciones:
- **PK**: `PRIMARY KEY (id)`
- **UNIQUE**: `UNIQUE (code)`

### `protein_sources`

Proteína principal de una receta; permite la regla de no repetirla en comidas consecutivas.

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | smallint | no |  |  |
| `code` | text | no |  |  |
| `name` | text | no |  |  |

Restricciones:
- **PK**: `PRIMARY KEY (id)`
- **UNIQUE**: `UNIQUE (code)`

### `units`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | smallint | no |  |  |
| `code` | text | no |  |  |
| `name` | text | no |  |  |
| `dimension` | units_dimension | no |  |  |
| `factor` | numeric(10,4) | no |  | mass: gramos por unidad. volume: mililitros por unidad. count: siempre 1 (el peso sale de ingredient_unit_weights). |
| `rounding_step` | numeric(6,3) | no |  | Redondeo práctico al escalar (ej. 0.25 tazas, 0.5 unidades). |

Restricciones:
- **CHECK**: `CHECK ((rounding_step > (0)::numeric))`
- **CHECK**: `CHECK ((factor > (0)::numeric))`
- **PK**: `PRIMARY KEY (id)`
- **UNIQUE**: `UNIQUE (code)`
- **UNIQUE**: `UNIQUE (id, dimension)`

### `medical_conditions`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | smallint | no |  |  |
| `code` | text | no |  |  |
| `name` | text | no |  |  |

Restricciones:
- **PK**: `PRIMARY KEY (id)`
- **UNIQUE**: `UNIQUE (code)`

### `recommendation_reasons`

Motivos tipificados ("sugerida porque tu cilantro vence"). El texto final se arma en la app con plantilla i18n.

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `code` | text | no |  |  |
| `description` | text | no |  |  |

Restricciones:
- **PK**: `PRIMARY KEY (code)`

### `rating_tags`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | smallint | no |  |  |
| `code` | text | no |  |  |
| `name` | text | no |  |  |

Restricciones:
- **PK**: `PRIMARY KEY (id)`
- **UNIQUE**: `UNIQUE (code)`

### `legal_documents`

Versiones publicadas de cada documento legal. Los textos los redacta y valida un abogado.

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | smallint | no |  |  |
| `kind` | legal_doc_kind | no |  |  |
| `version` | smallint | no |  |  |
| `published_at` | timestamp with time zone | no | now() |  |
| `content_url` | text | sí |  |  |
| `content_sha256` | text | sí |  | Hash del texto publicado: prueba de qué versión exacta aceptó cada persona (art. 9 y 17 Ley 1581). |

Restricciones:
- **CHECK**: `CHECK (((content_url IS NULL) = (content_sha256 IS NULL)))`
- **CHECK**: `CHECK ((version > 0))`
- **PK**: `PRIMARY KEY (id)`
- **UNIQUE**: `UNIQUE (kind, version)`

### `price_sources`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | smallint | no |  |  |
| `name` | text | no |  |  |
| `url` | text | sí |  |  |
| `license_notes` | text | sí |  |  |

Restricciones:
- **PK**: `PRIMARY KEY (id)`
- **UNIQUE**: `UNIQUE (name)`

## Identidad y privacidad


### `profiles`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | uuid | no |  |  |
| `display_name` | text | sí |  |  |
| `region_id` | smallint | sí |  |  |
| `household_size` | smallint | no | 2 |  |
| `budget_amount` | numeric(12,2) | sí |  | Monto y periodo van juntos. La moneda se deriva de region_id > countries. |
| `budget_period` | budget_period | sí |  |  |
| `max_cook_minutes` | smallint | sí |  |  |
| `spice_tolerance` | smallint | no | 2 | Nivel máximo de picante aceptado: 0 ninguno, 1 suave, 2 medio, 3 picante. |
| `target_protein_pct` | smallint | sí |  | Carbohidratos y grasa se derivan; no se guardan para evitar inconsistencias. |
| `daily_kcal_target` | integer | sí |  |  |
| `prioritize_pantry` | boolean | no | true |  |
| `batch_cooking` | boolean | no | false |  |
| `analytics_enabled` | boolean | no | true |  |
| `onboarding_completed_at` | timestamp with time zone | sí |  |  |
| `created_at` | timestamp with time zone | no | now() |  |
| `updated_at` | timestamp with time zone | no | now() |  |
| `adult_declared_at` | timestamp with time zone | sí |  | Momento en que la persona declaró ser mayor de 18 años. Se guarda solo la declaración, no la fecha de nacimiento (minimización). |

Restricciones:
- **CHECK**: `CHECK (((daily_kcal_target >= 800) AND (daily_kcal_target <= 6000)))`
- **CHECK**: `CHECK (((target_protein_pct >= 10) AND (target_protein_pct <= 50)))`
- **CHECK**: `CHECK (((spice_tolerance >= 0) AND (spice_tolerance <= 3)))`
- **CHECK**: `CHECK (((max_cook_minutes >= 5) AND (max_cook_minutes <= 240)))`
- **CHECK**: `CHECK ((char_length(display_name) <= 80))`
- **CHECK**: `CHECK ((budget_amount > (0)::numeric))`
- **CHECK**: `CHECK (((household_size >= 1) AND (household_size <= 12)))`
- **CHECK**: `CHECK (((budget_amount IS NULL) = (budget_period IS NULL)))`
- **FK**: `FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (region_id) REFERENCES regions(id)`
- **PK**: `PRIMARY KEY (id)`

### `profile_health`

Datos sensibles (Ley 1581/2012, art. 5). Requieren autorización expresa y separada (sensitive_data_authorization); se borran si se revoca.

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `user_id` | uuid | no |  |  |
| `sex` | sex | sí |  |  |
| `height_cm` | numeric(4,1) | sí |  |  |
| `weight_kg` | numeric(5,1) | sí |  |  |
| `activity_level` | activity_level | sí |  |  |
| `goal` | health_goal | sí |  |  |
| `updated_at` | timestamp with time zone | no | now() |  |
| `birth_year` | smallint | sí |  | Solo el año: alcanza para calcular necesidades y evita guardar la fecha completa (minimización). |

Restricciones:
- **CHECK**: `CHECK (((birth_year >= 1900) AND (birth_year <= ((EXTRACT(year FROM CURRENT_DATE))::integer - 18))))`
- **CHECK**: `CHECK (((height_cm >= (50)::numeric) AND (height_cm <= (260)::numeric)))`
- **CHECK**: `CHECK (((weight_kg >= (20)::numeric) AND (weight_kg <= (400)::numeric)))`
- **FK**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (user_id)`

### `user_roles`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `user_id` | uuid | no |  |  |
| `role` | app_role | no |  |  |
| `granted_at` | timestamp with time zone | no | now() |  |

Restricciones:
- **FK**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (user_id, role)`

### `user_consents`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `user_id` | uuid | no |  |  |
| `document_id` | smallint | no |  |  |
| `accepted_at` | timestamp with time zone | no | now() |  |
| `revoked_at` | timestamp with time zone | sí |  | Revocatoria de la autorización (art. 8 Ley 1581). El registro se conserva como prueba; los datos asociados se borran. |

Restricciones:
- **FK**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (document_id) REFERENCES legal_documents(id)`
- **PK**: `PRIMARY KEY (user_id, document_id)`

### `notification_preferences`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `user_id` | uuid | no |  |  |
| `frequency` | notification_frequency | no | 'daily'::notification_frequency |  |
| `meal_reminder_lead_minutes` | smallint | no | 30 |  |
| `expiry_alerts_enabled` | boolean | no | true |  |
| `updated_at` | timestamp with time zone | no | now() |  |

Restricciones:
- **CHECK**: `CHECK (((meal_reminder_lead_minutes >= 0) AND (meal_reminder_lead_minutes <= 240)))`
- **FK**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (user_id)`

### `push_devices`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |  |
| `user_id` | uuid | no |  |  |
| `expo_push_token` | text | no |  |  |
| `platform` | device_platform | no |  |  |
| `created_at` | timestamp with time zone | no | now() |  |
| `last_seen_at` | timestamp with time zone | no | now() |  |

Restricciones:
- **FK**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (id)`
- **UNIQUE**: `UNIQUE (expo_push_token)`

## Catálogo y recetas


### `ingredients`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |  |
| `name` | text | no |  |  |
| `food_group_id` | smallint | no |  |  |
| `store_category_id` | smallint | no |  |  |
| `density_g_per_ml` | numeric(6,3) | no | 1.000 | Para pasar volumen a gramos (taza de harina ≈ 0.5). Por defecto 1.0 (agua). |
| `heat_level` | smallint | no | 0 | 0 sin picante ... 3 picante. El picante de una receta se deriva del máximo de sus ingredientes. |
| `shelf_life_days` | smallint | sí |  |  |
| `rounding_step` | numeric(6,3) | sí |  | Sobrescribe units.rounding_step (ej. huevos: 1, nunca 0.5). |
| `created_at` | timestamp with time zone | no | now() |  |

Restricciones:
- **CHECK**: `CHECK ((density_g_per_ml > (0)::numeric))`
- **CHECK**: `CHECK (((heat_level >= 0) AND (heat_level <= 3)))`
- **CHECK**: `CHECK ((rounding_step > (0)::numeric))`
- **CHECK**: `CHECK (((char_length(name) >= 2) AND (char_length(name) <= 80)))`
- **CHECK**: `CHECK ((shelf_life_days > 0))`
- **FK**: `FOREIGN KEY (food_group_id) REFERENCES food_groups(id)`
- **FK**: `FOREIGN KEY (store_category_id) REFERENCES ingredient_categories(id)`
- **PK**: `PRIMARY KEY (id)`

### `ingredient_unit_weights`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `ingredient_id` | uuid | no |  |  |
| `unit_id` | smallint | no |  |  |
| `unit_dimension` | units_dimension | no | 'count'::units_dimension | Columna constante: junto con la FK compuesta garantiza que solo se registren pesos para unidades de tipo count. |
| `grams` | numeric(8,2) | no |  |  |

Restricciones:
- **CHECK**: `CHECK ((unit_dimension = 'count'::units_dimension))`
- **CHECK**: `CHECK ((grams > (0)::numeric))`
- **FK**: `FOREIGN KEY (unit_id, unit_dimension) REFERENCES units(id, dimension)`
- **FK**: `FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (ingredient_id, unit_id)`

### `ingredient_nutrition`

Valores por 100 g. Separada de ingredients: es un dato con fuente y fecha de verificación propias.

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `ingredient_id` | uuid | no |  |  |
| `kcal` | numeric(7,2) | no |  |  |
| `protein_g` | numeric(6,2) | no |  |  |
| `carbs_g` | numeric(6,2) | no |  |  |
| `fat_g` | numeric(6,2) | no |  |  |
| `fiber_g` | numeric(6,2) | no |  |  |
| `sugar_g` | numeric(6,2) | no |  |  |
| `sodium_mg` | numeric(8,2) | no |  |  |
| `source` | text | no |  |  |
| `reference_url` | text | sí |  |  |
| `verified_at` | date | sí |  |  |

Restricciones:
- **CHECK**: `CHECK ((sodium_mg >= (0)::numeric))`
- **CHECK**: `CHECK ((carbs_g >= (0)::numeric))`
- **CHECK**: `CHECK (((sugar_g <= carbs_g) AND (fiber_g <= carbs_g)))`
- **CHECK**: `CHECK ((fat_g >= (0)::numeric))`
- **CHECK**: `CHECK ((fiber_g >= (0)::numeric))`
- **CHECK**: `CHECK ((sugar_g >= (0)::numeric))`
- **CHECK**: `CHECK ((protein_g >= (0)::numeric))`
- **CHECK**: `CHECK ((((protein_g + carbs_g) + fat_g) <= 100.5))`
- **CHECK**: `CHECK ((kcal >= (0)::numeric))`
- **FK**: `FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (ingredient_id)`

### `ingredient_allergens`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `ingredient_id` | uuid | no |  |  |
| `allergen_id` | smallint | no |  |  |

Restricciones:
- **FK**: `FOREIGN KEY (allergen_id) REFERENCES allergens(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (ingredient_id, allergen_id)`

### `ingredient_substitutions`

Sustitutos candidatos. Qué sustitutos sirven a cada usuario se decide al consultar (suggest_substitutes), según sus alérgenos y dietas.

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `ingredient_id` | uuid | no |  |  |
| `substitute_id` | uuid | no |  |  |
| `ratio` | numeric(6,3) | no | 1 |  |
| `note` | text | sí |  |  |

Restricciones:
- **CHECK**: `CHECK ((ingredient_id <> substitute_id))`
- **CHECK**: `CHECK ((ratio > (0)::numeric))`
- **FK**: `FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (substitute_id) REFERENCES ingredients(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (ingredient_id, substitute_id)`

### `ingredient_prices`

Historial de precios por kg (unidad canónica). La moneda sale de region > country. Moneda y vigencia no se repiten por fila.

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | bigint | no |  |  |
| `ingredient_id` | uuid | no |  |  |
| `region_id` | smallint | no |  |  |
| `price_per_kg` | numeric(12,2) | no |  |  |
| `source_id` | smallint | no |  |  |
| `observed_on` | date | no |  |  |

Restricciones:
- **CHECK**: `CHECK ((price_per_kg > (0)::numeric))`
- **FK**: `FOREIGN KEY (region_id) REFERENCES regions(id)`
- **FK**: `FOREIGN KEY (source_id) REFERENCES price_sources(id)`
- **FK**: `FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (id)`
- **UNIQUE**: `UNIQUE (ingredient_id, region_id, source_id, observed_on)`

### `recipes`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |  |
| `author_id` | uuid | sí |  | Al borrar la cuenta del autor la receta se anonimiza (SET NULL), no se pierde. |
| `title` | text | no |  |  |
| `description` | text | sí |  |  |
| `cuisine_id` | smallint | sí |  |  |
| `main_protein_id` | smallint | sí |  |  |
| `base_servings` | smallint | no |  |  |
| `prep_minutes` | smallint | no |  |  |
| `cook_minutes` | smallint | no | 0 |  |
| `total_minutes` | smallint | sí | generada: (prep_minutes + cook_minutes) |  |
| `difficulty` | smallint | no | 1 |  |
| `keeps_days` | smallint | sí |  | Días de conservación. "Apta para batch cooking" no se guarda: se deriva (base_servings >= 4 y keeps_days no nulo). |
| `storage_notes` | text | sí |  |  |
| `status` | recipe_status | no | 'draft'::recipe_status |  |
| `published_at` | timestamp with time zone | sí |  |  |
| `image_path` | text | sí |  |  |
| `created_at` | timestamp with time zone | no | now() |  |
| `updated_at` | timestamp with time zone | no | now() |  |
| `search_tsv` | tsvector | sí | generada: to_tsvector('spanish'::regconfig, ((title \|\| ' '::text) \|\| COALESCE(description, ''::text))) |  |

Restricciones:
- **CHECK**: `CHECK (((keeps_days IS NULL) = (storage_notes IS NULL)))`
- **CHECK**: `CHECK ((prep_minutes >= 0))`
- **CHECK**: `CHECK (((base_servings >= 1) AND (base_servings <= 24)))`
- **CHECK**: `CHECK ((keeps_days > 0))`
- **CHECK**: `CHECK ((cook_minutes >= 0))`
- **CHECK**: `CHECK (((difficulty >= 1) AND (difficulty <= 3)))`
- **CHECK**: `CHECK (((char_length(title) >= 3) AND (char_length(title) <= 120)))`
- **CHECK**: `CHECK (((status <> 'published'::recipe_status) OR (published_at IS NOT NULL)))`
- **FK**: `FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL`
- **FK**: `FOREIGN KEY (cuisine_id) REFERENCES cuisines(id)`
- **FK**: `FOREIGN KEY (main_protein_id) REFERENCES protein_sources(id)`
- **PK**: `PRIMARY KEY (id)`

### `recipe_meal_slots`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `recipe_id` | uuid | no |  |  |
| `slot` | meal_slot | no |  |  |

Restricciones:
- **FK**: `FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (recipe_id, slot)`

### `recipe_ingredients`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `recipe_id` | uuid | no |  |  |
| `ingredient_id` | uuid | no |  |  |
| `quantity` | numeric(10,3) | no |  |  |
| `unit_id` | smallint | no |  |  |
| `is_optional` | boolean | no | false |  |
| `scaling_exponent` | numeric(3,2) | no | 1.00 | Cantidad escalada = base × (porciones/porciones_base)^exponente. 1 lineal; ~0.7 especias; 0 fija (una hoja de laurel). |
| `notes` | text | sí |  |  |
| `sort_order` | smallint | no | 0 |  |

Restricciones:
- **CHECK**: `CHECK (((scaling_exponent >= (0)::numeric) AND (scaling_exponent <= (1)::numeric)))`
- **CHECK**: `CHECK ((quantity > (0)::numeric))`
- **FK**: `FOREIGN KEY (unit_id) REFERENCES units(id)`
- **FK**: `FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)`
- **PK**: `PRIMARY KEY (recipe_id, ingredient_id)`

### `recipe_steps`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `recipe_id` | uuid | no |  |  |
| `step_number` | smallint | no |  |  |
| `instruction` | text | no |  |  |
| `timer_seconds` | integer | sí |  |  |

Restricciones:
- **CHECK**: `CHECK ((timer_seconds > 0))`
- **CHECK**: `CHECK ((step_number > 0))`
- **FK**: `FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (recipe_id, step_number)`

### `recipe_diet_tags`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `recipe_id` | uuid | no |  |  |
| `diet_id` | smallint | no |  |  |
| `diet_kind` | diet_kind | no | 'curated'::diet_kind |  |

Restricciones:
- **CHECK**: `CHECK ((diet_kind = 'curated'::diet_kind))`
- **FK**: `FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (diet_id, diet_kind) REFERENCES diets(id, kind)`
- **PK**: `PRIMARY KEY (recipe_id, diet_id)`

### `nutritionist_reviews`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |  |
| `recipe_id` | uuid | no |  |  |
| `reviewer_id` | uuid | sí |  |  |
| `reviewer_name` | text | no |  | Copia intencional del nombre: el registro de quién revisó debe sobrevivir si la cuenta del revisor se elimina. |
| `reviewer_license` | text | sí |  |  |
| `outcome` | review_outcome | no |  |  |
| `notes` | text | sí |  |  |
| `reviewed_at` | timestamp with time zone | no | now() |  |

Restricciones:
- **FK**: `FOREIGN KEY (reviewer_id) REFERENCES profiles(id) ON DELETE SET NULL`
- **FK**: `FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (id)`

## Preferencias del usuario


### `user_diets`

"Omnívoro" no es una fila: es la ausencia de dietas.

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `user_id` | uuid | no |  |  |
| `diet_id` | smallint | no |  |  |

Restricciones:
- **FK**: `FOREIGN KEY (diet_id) REFERENCES diets(id)`
- **FK**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (user_id, diet_id)`

### `user_allergens`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `user_id` | uuid | no |  |  |
| `allergen_id` | smallint | no |  |  |

Restricciones:
- **FK**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (allergen_id) REFERENCES allergens(id)`
- **PK**: `PRIMARY KEY (user_id, allergen_id)`

### `user_conditions`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `user_id` | uuid | no |  |  |
| `condition_id` | smallint | no |  |  |
| `declared_at` | timestamp with time zone | no | now() |  |

Restricciones:
- **FK**: `FOREIGN KEY (condition_id) REFERENCES medical_conditions(id)`
- **FK**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (user_id, condition_id)`

### `user_disliked_ingredients`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `user_id` | uuid | no |  |  |
| `ingredient_id` | uuid | no |  |  |

Restricciones:
- **FK**: `FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (user_id, ingredient_id)`

### `user_cuisines`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `user_id` | uuid | no |  |  |
| `cuisine_id` | smallint | no |  |  |

Restricciones:
- **FK**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (cuisine_id) REFERENCES cuisines(id)`
- **PK**: `PRIMARY KEY (user_id, cuisine_id)`

### `favorite_recipes`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `user_id` | uuid | no |  |  |
| `recipe_id` | uuid | no |  |  |
| `created_at` | timestamp with time zone | no | now() |  |

Restricciones:
- **FK**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (user_id, recipe_id)`

### `user_section_order`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `user_id` | uuid | no |  |  |
| `store_category_id` | smallint | no |  |  |
| `position` | smallint | no |  |  |

Restricciones:
- **CHECK**: `CHECK (("position" > 0))`
- **FK**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (store_category_id) REFERENCES ingredient_categories(id)`
- **PK**: `PRIMARY KEY (user_id, store_category_id)`

## Despensa, planes y compras


### `pantry_items`

Cantidad canónica en gramos. Mismo ingrediente y misma fecha = mismo lote (la cantidad se suma). Fechas distintas = lotes distintos.

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |  |
| `user_id` | uuid | no |  |  |
| `ingredient_id` | uuid | no |  |  |
| `quantity_g` | numeric(10,2) | no |  |  |
| `expires_on` | date | sí |  |  |
| `created_at` | timestamp with time zone | no | now() |  |
| `updated_at` | timestamp with time zone | no | now() |  |

Restricciones:
- **CHECK**: `CHECK ((quantity_g >= (0)::numeric))`
- **FK**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)`
- **PK**: `PRIMARY KEY (id)`
- **UNIQUE**: `UNIQUE NULLS NOT DISTINCT (user_id, ingredient_id, expires_on)`

### `meal_plans`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |  |
| `user_id` | uuid | no |  |  |
| `start_date` | date | no |  |  |
| `end_date` | date | no |  |  |
| `status` | plan_status | no | 'draft'::plan_status |  |
| `budget_limit` | numeric(12,2) | sí |  | Instantánea del tope de gasto aplicable a ESTE plan, calculada al crearlo desde el perfil. Desnormalización intencional: el presupuesto del perfil puede cambiar y el historial no debe cambiar con él. |
| `created_at` | timestamp with time zone | no | now() |  |
| `updated_at` | timestamp with time zone | no | now() |  |

Restricciones:
- **CHECK**: `CHECK (((end_date >= start_date) AND ((end_date - start_date) <= 13)))`
- **CHECK**: `CHECK ((budget_limit > (0)::numeric))`
- **FK**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (id)`
- **EXCLUDE**: `EXCLUDE USING gist (user_id WITH =, daterange(start_date, end_date, '[]'::text) WITH &&) WHERE ((status <> 'archived'::plan_status))`

### `planned_meals`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |  |
| `plan_id` | uuid | no |  |  |
| `meal_date` | date | no |  |  |
| `slot` | meal_slot | no |  |  |
| `recipe_id` | uuid | no |  |  |
| `servings` | numeric(5,2) | no |  |  |
| `status` | meal_status | no | 'planned'::meal_status |  |
| `cooked_at` | timestamp with time zone | sí |  |  |
| `reason_code` | text | sí |  |  |
| `reason_ingredient_id` | uuid | sí |  |  |
| `replaced_recipe_id` | uuid | sí |  | Receta anterior cuando el usuario cambió la comida (historial del cambio). |
| `created_at` | timestamp with time zone | no | now() |  |
| `updated_at` | timestamp with time zone | no | now() |  |

Restricciones:
- **CHECK**: `CHECK (((reason_code IS NOT NULL) OR (reason_ingredient_id IS NULL)))`
- **CHECK**: `CHECK (((servings > (0)::numeric) AND (servings <= (48)::numeric)))`
- **CHECK**: `CHECK (((status = 'cooked'::meal_status) = (cooked_at IS NOT NULL)))`
- **FK**: `FOREIGN KEY (reason_ingredient_id) REFERENCES ingredients(id)`
- **FK**: `FOREIGN KEY (plan_id) REFERENCES meal_plans(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (recipe_id) REFERENCES recipes(id)`
- **FK**: `FOREIGN KEY (replaced_recipe_id) REFERENCES recipes(id)`
- **FK**: `FOREIGN KEY (reason_code) REFERENCES recommendation_reasons(code)`
- **PK**: `PRIMARY KEY (id)`
- **UNIQUE**: `UNIQUE (plan_id, meal_date, slot)`

### `meal_pantry_deductions`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `planned_meal_id` | uuid | no |  |  |
| `pantry_item_id` | uuid | no |  |  |
| `grams` | numeric(10,2) | no |  |  |

Restricciones:
- **CHECK**: `CHECK ((grams > (0)::numeric))`
- **FK**: `FOREIGN KEY (pantry_item_id) REFERENCES pantry_items(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (planned_meal_id) REFERENCES planned_meals(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (planned_meal_id, pantry_item_id)`

### `shopping_lists`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |  |
| `user_id` | uuid | no |  |  |
| `plan_id` | uuid | sí |  |  |
| `name` | text | no | 'Lista de compras'::text |  |
| `status` | list_status | no | 'active'::list_status |  |
| `created_at` | timestamp with time zone | no | now() |  |
| `updated_at` | timestamp with time zone | no | now() |  |

Restricciones:
- **CHECK**: `CHECK (((char_length(name) >= 1) AND (char_length(name) <= 80)))`
- **FK**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (plan_id) REFERENCES meal_plans(id) ON DELETE SET NULL`
- **PK**: `PRIMARY KEY (id)`

### `shopping_list_items`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |  |
| `list_id` | uuid | no |  |  |
| `ingredient_id` | uuid | sí |  |  |
| `custom_name` | text | sí |  |  |
| `store_category_id` | smallint | sí |  | Solo para ítems libres; en ítems de ingrediente la sección sale de ingredients.store_category_id. |
| `needed_g` | numeric(10,2) | sí |  |  |
| `pantry_g` | numeric(10,2) | no | 0 | Instantánea de lo que había en despensa al generar la lista. to_buy_g = max(necesario - despensa, 0) es una columna generada. |
| `to_buy_g` | numeric(10,2) | sí |  |  |
| `is_checked` | boolean | no | false |  |
| `checked_at` | timestamp with time zone | sí |  |  |
| `source` | shopping_item_source | no | 'manual'::shopping_item_source |  |
| `created_at` | timestamp with time zone | no | now() |  |

Restricciones:
- **CHECK**: `CHECK ((needed_g > (0)::numeric))`
- **CHECK**: `CHECK ((is_checked = (checked_at IS NOT NULL)))`
- **CHECK**: `CHECK (((ingredient_id IS NULL) OR (store_category_id IS NULL)))`
- **CHECK**: `CHECK (((source <> 'plan'::shopping_item_source) OR (ingredient_id IS NOT NULL)))`
- **CHECK**: `CHECK (((ingredient_id IS NULL) <> (custom_name IS NULL)))`
- **CHECK**: `CHECK ((pantry_g >= (0)::numeric))`
- **CHECK**: `CHECK (((char_length(custom_name) >= 1) AND (char_length(custom_name) <= 80)))`
- **FK**: `FOREIGN KEY (store_category_id) REFERENCES ingredient_categories(id)`
- **FK**: `FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)`
- **FK**: `FOREIGN KEY (list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (id)`
- **UNIQUE**: `UNIQUE (list_id, ingredient_id)`

### `purchases`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |  |
| `user_id` | uuid | no |  |  |
| `shopping_list_id` | uuid | sí |  |  |
| `purchased_on` | date | no | CURRENT_DATE |  |
| `store_name` | text | sí |  |  |
| `total_amount` | numeric(12,2) | no |  | Total real pagado. NO se deriva de purchase_items: impuestos y líneas no reconocidas hacen que sean hechos independientes. |
| `created_at` | timestamp with time zone | no | now() |  |

Restricciones:
- **CHECK**: `CHECK ((char_length(store_name) <= 80))`
- **CHECK**: `CHECK ((total_amount >= (0)::numeric))`
- **FK**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (shopping_list_id) REFERENCES shopping_lists(id) ON DELETE SET NULL`
- **PK**: `PRIMARY KEY (id)`

### `purchase_items`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |  |
| `purchase_id` | uuid | no |  |  |
| `ingredient_id` | uuid | sí |  |  |
| `raw_text` | text | sí |  |  |
| `quantity_g` | numeric(10,2) | sí |  |  |
| `line_amount` | numeric(12,2) | no |  |  |

Restricciones:
- **CHECK**: `CHECK ((line_amount >= (0)::numeric))`
- **CHECK**: `CHECK ((quantity_g > (0)::numeric))`
- **CHECK**: `CHECK (((ingredient_id IS NOT NULL) OR (raw_text IS NOT NULL)))`
- **FK**: `FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)`
- **PK**: `PRIMARY KEY (id)`

## Comunidad, asistente y soporte


### `recipe_ratings`

Historial: cada vez que se cocina y califica queda una fila (receta + usuario + fecha).

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |  |
| `user_id` | uuid | no |  |  |
| `recipe_id` | uuid | no |  |  |
| `planned_meal_id` | uuid | sí |  |  |
| `rating` | smallint | no |  |  |
| `comment` | character varying(200) | sí |  |  |
| `rated_at` | timestamp with time zone | no | now() |  |

Restricciones:
- **CHECK**: `CHECK (((rating >= 1) AND (rating <= 5)))`
- **FK**: `FOREIGN KEY (planned_meal_id) REFERENCES planned_meals(id) ON DELETE SET NULL`
- **FK**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (id)`
- **UNIQUE**: `UNIQUE (planned_meal_id)`

### `recipe_rating_tag_links`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `rating_id` | uuid | no |  |  |
| `tag_id` | smallint | no |  |  |

Restricciones:
- **FK**: `FOREIGN KEY (rating_id) REFERENCES recipe_ratings(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (tag_id) REFERENCES rating_tags(id)`
- **PK**: `PRIMARY KEY (rating_id, tag_id)`

### `recipe_comments`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |  |
| `recipe_id` | uuid | no |  |  |
| `user_id` | uuid | no |  |  |
| `body` | text | no |  |  |
| `hidden_at` | timestamp with time zone | sí |  |  |
| `created_at` | timestamp with time zone | no | now() |  |

Restricciones:
- **CHECK**: `CHECK (((char_length(body) >= 1) AND (char_length(body) <= 1000)))`
- **FK**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (id)`

### `content_reports`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |  |
| `reporter_id` | uuid | no |  |  |
| `comment_id` | uuid | sí |  |  |
| `recipe_id` | uuid | sí |  |  |
| `reason` | report_reason | no |  |  |
| `details` | character varying(500) | sí |  |  |
| `created_at` | timestamp with time zone | no | now() |  |
| `resolved_at` | timestamp with time zone | sí |  |  |
| `resolved_by` | uuid | sí |  |  |

Restricciones:
- **CHECK**: `CHECK (((comment_id IS NULL) <> (recipe_id IS NULL)))`
- **FK**: `FOREIGN KEY (resolved_by) REFERENCES profiles(id) ON DELETE SET NULL`
- **FK**: `FOREIGN KEY (reporter_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (comment_id) REFERENCES recipe_comments(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (id)`
- **UNIQUE**: `UNIQUE (reporter_id, comment_id)`
- **UNIQUE**: `UNIQUE (reporter_id, recipe_id)`

### `support_tickets`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |  |
| `user_id` | uuid | no |  |  |
| `category` | ticket_category | no |  |  |
| `message` | character varying(500) | no |  |  |
| `app_version` | text | sí |  |  |
| `device_model` | text | sí |  |  |
| `screenshot_path` | text | sí |  |  |
| `created_at` | timestamp with time zone | no | now() |  |

Restricciones:
- **CHECK**: `CHECK ((char_length((message)::text) >= 1))`
- **FK**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (id)`

### `assistant_conversations`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | uuid | no | gen_random_uuid() |  |
| `user_id` | uuid | no |  |  |
| `created_at` | timestamp with time zone | no | now() |  |

Restricciones:
- **FK**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (id)`

### `assistant_messages`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | bigint | no |  |  |
| `conversation_id` | uuid | no |  |  |
| `role` | chat_role | no |  |  |
| `content` | text | no |  |  |
| `suggested_recipe_id` | uuid | sí |  | La sugerencia es un dato tipado (receta + comida destino), no JSON libre: la base la valida como cualquier otro cambio al plan. |
| `target_planned_meal_id` | uuid | sí |  |  |
| `applied_at` | timestamp with time zone | sí |  |  |
| `created_at` | timestamp with time zone | no | now() |  |

Restricciones:
- **CHECK**: `CHECK (((role = 'assistant'::chat_role) OR ((suggested_recipe_id IS NULL) AND (target_planned_meal_id IS NULL) AND (applied_at IS NULL))))`
- **CHECK**: `CHECK (((target_planned_meal_id IS NULL) OR (suggested_recipe_id IS NOT NULL)))`
- **FK**: `FOREIGN KEY (conversation_id) REFERENCES assistant_conversations(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (target_planned_meal_id) REFERENCES planned_meals(id) ON DELETE SET NULL`
- **FK**: `FOREIGN KEY (suggested_recipe_id) REFERENCES recipes(id)`
- **PK**: `PRIMARY KEY (id)`

### `ai_generations`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | bigint | no |  |  |
| `user_id` | uuid | no |  |  |
| `kind` | ai_kind | no |  |  |
| `model` | text | no |  |  |
| `input_tokens` | integer | sí |  |  |
| `output_tokens` | integer | sí |  |  |
| `latency_ms` | integer | sí |  |  |
| `created_at` | timestamp with time zone | no | now() |  |

Restricciones:
- **CHECK**: `CHECK ((input_tokens >= 0))`
- **CHECK**: `CHECK ((latency_ms >= 0))`
- **CHECK**: `CHECK ((output_tokens >= 0))`
- **FK**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (id)`

### `notifications`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | bigint | no |  |  |
| `user_id` | uuid | no |  |  |
| `kind` | notification_kind | no |  |  |
| `planned_meal_id` | uuid | sí |  |  |
| `pantry_item_id` | uuid | sí |  |  |
| `scheduled_for` | timestamp with time zone | no |  |  |
| `sent_at` | timestamp with time zone | sí |  |  |

Restricciones:
- **CHECK**: `CHECK (((kind = 'meal_reminder'::notification_kind) = (planned_meal_id IS NOT NULL)))`
- **CHECK**: `CHECK (((kind = 'expiry_alert'::notification_kind) = (pantry_item_id IS NOT NULL)))`
- **FK**: `FOREIGN KEY (planned_meal_id) REFERENCES planned_meals(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **FK**: `FOREIGN KEY (pantry_item_id) REFERENCES pantry_items(id) ON DELETE CASCADE`
- **PK**: `PRIMARY KEY (id)`
- **UNIQUE**: `UNIQUE (kind, planned_meal_id)`
- **UNIQUE**: `UNIQUE (kind, pantry_item_id)`

### `analytics_events`

| Columna | Tipo | Nulo | Default / generada | Nota |
|---|---|---|---|---|
| `id` | bigint | no |  |  |
| `anonymous_id` | uuid | no |  |  |
| `event_type` | analytics_event | no |  |  |
| `occurred_at` | timestamp with time zone | no | now() |  |
| `app_version` | text | sí |  |  |
| `platform` | device_platform | sí |  |  |

Restricciones:
- **PK**: `PRIMARY KEY (id)`

## Vistas

- `my_monthly_spend`: ver migración
- `my_pending_consents`: ver migración
- `my_plan_conflicts`: Comidas futuras del plan que chocan con las alergias declaradas HOY (p. ej. alergia declarada después de planear).
- `recipe_allergens`: Alérgenos de una receta, derivados de TODOS sus ingredientes (incluidos los opcionales: la seguridad no admite excepciones).
- `recipe_diets`: Dietas compatibles: derivadas de ingredientes (rule_based) o etiquetadas por nutricionista (curated).
- `recipe_max_heat`: ver migración
- `recipe_nutrition`: Nutrición por porción a las porciones base, calculada desde los ingredientes. Nunca se captura a mano.
- `recipe_rating_stats`: ver migración

## Enums

- `activity_level`: sedentary, light, moderate, active, very_active
- `ai_kind`: plan, swap, chat
- `analytics_event`: onboarding_completed, plan_generated, shopping_list_generated, meal_cooked
- `app_role`: moderator, nutritionist, admin
- `budget_period`: week, month
- `chat_role`: user, assistant
- `device_platform`: ios, android
- `diet_kind`: rule_based, curated
- `health_goal`: lose_weight, maintain, gain_muscle, eat_healthier, save_time
- `legal_doc_kind`: privacy_policy, terms, health_disclaimer, community_sharing, sensitive_data_authorization
- `list_status`: active, completed
- `meal_slot`: breakfast, lunch, dinner, snack
- `meal_status`: planned, cooked, skipped
- `notification_frequency`: none, weekly_summary, daily
- `notification_kind`: meal_reminder, expiry_alert, weekly_summary
- `plan_status`: draft, confirmed, archived
- `recipe_status`: draft, in_review, published, rejected
- `report_reason`: spam, dangerous_advice, offensive, other
- `review_outcome`: approved, rejected
- `sex`: female, male, prefer_not_say
- `shopping_item_source`: plan, manual
- `ticket_category`: bug, suggestion
- `units_dimension`: mass, volume, count
