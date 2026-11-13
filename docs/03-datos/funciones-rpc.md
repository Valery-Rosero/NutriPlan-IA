# Funciones RPC públicas (`supabase.rpc`)

Todas `SECURITY INVOKER` (respetan RLS) salvo `export_my_data`, `register_push_device`, `unregister_push_device` y `report_app_error` (las tres últimas, `SECURITY DEFINER` con filtro explícito por `auth.uid()` y límite de tasa). Requieren sesión (`authenticated`), salvo `report_app_error`, que también acepta `anon` para registrar fallas antes de iniciar sesión. Definidas en `backend/supabase/migrations/`; la columna "Migración" indica dónde. Errores: el mensaje empieza por un código (`plan_not_found: …`) que la app traduce en `app/src/core/errors/`.

| Función | Parámetros | Devuelve | Uso |
|---|---|---|---|
| `eligible_recipes` | `p_slot meal_slot?`, `p_max_minutes int?` | `setof recipes` | Conjunto seguro para el usuario; base de plan y asistente |
| `scale_recipe` | `p_recipe_id uuid`, `p_servings numeric` | tabla: `ingredient_id, ingredient_name, is_optional, quantity, unit_id, unit_code, grams, group_key, group_label` | Ingredientes escalados; los grupos intercambiables se resuelven con la despensa de quien consulta |
| `recipe_cost` | `p_recipe_id`, `p_region_id smallint`, `p_servings numeric?` | `cost, currency_code, missing_prices, estimated_prices` | Costo de una receta |
| `search_ingredients` | `p_query text`, `p_limit int=20` | `setof ingredients` | Buscador (alergias, despensa, no me gusta) |
| `suggest_substitutes` | `p_ingredient_id uuid` | `substitute_id, substitute_name, ratio, note` | Sustitutos permitidos al usuario |
| `add_to_pantry` | `p_ingredient_id`, `p_quantity numeric`, `p_unit_id smallint`, `p_expires_on date?` | `pantry_items` | Agregar a despensa |
| `recipe_pantry_match` | `p_recipe_id` | `matched_ingredients, total_ingredients, coverage` | % cubierto por despensa |
| `recipes_using_expiring_ingredients` | `p_within_days int=3` | ítem por vencer + recetas elegibles | Alertas y "cocinar con lo que vence" |
| `generate_shopping_list` | `p_plan_id uuid` | `uuid` (lista) | Lista de compras |
| `plan_budget_status` | `p_plan_id uuid` | `estimated_cost, budget_limit, over_by, currency_code, missing_prices, estimated_prices` | Presupuesto |
| `mark_meal_cooked` | `p_planned_meal_id uuid` | `jsonb` | Cocinar y descontar despensa |
| `undo_meal_cooked` | `p_planned_meal_id`, `p_window interval='10 seconds'` | `void` | Deshacer |
| `apply_assistant_suggestion` | `p_message_id bigint` | `uuid` (comida planificada) | Aplicar sugerencia; exige que la receta esté en `eligible_recipes(slot)` (`not_eligible`) |
| `export_my_data` | — | `jsonb` | Portabilidad (derecho de acceso) |
| `accept_consent` | `p_document_id smallint` | `void` | Aceptar documento (idempotente por versión) |
| `revoke_consent` | `p_kind legal_doc_kind` | `jsonb` | Revocar (p. ej. datos sensibles) |

**Vistas útiles:** `my_pending_consents`, `my_plan_conflicts` (comidas futuras que chocan con alergias declaradas hoy), `my_monthly_spend`, `my_shopping_items` (lista con sustituciones aplicadas), `recipe_allergens`, `recipe_diets`, `recipe_max_heat`, `recipe_nutrition` (por porción), `recipe_rating_stats` (ver `modelo-de-datos.md`, sección Vistas).
**Cómo se prueba:** `backend/supabase/tests/run_local.sh` (Supabase local en Docker; 344 comprobaciones) y `npm run test:integration` en `app/` (recorrido contra Supabase real).

## Recetas versátiles y plan (migración `20261013000200`, ADR-020)
| Función | Parámetros | Devuelve | Uso |
|---|---|---|---|
| `cook_with_what_i_have` | `p_slot meal_slot?`, `p_servings numeric?` (def. tamaño del hogar), `p_limit int=10` | `recipe_id, title, total_minutes, coverage, missing_count, missing jsonb, uses_expiring` | **Pantalla principal**: ¿qué cocino con lo que tengo? |
| `recipe_flex_menu` | `p_recipe_id`, `p_planned_meal_id?` | `group_key, group_label, min_choices, max_choices, ingredient_id, ingredient_name, in_pantry, is_default, selected` | Opciones seguras de cada grupo para la UI |
| `set_meal_choices` | `p_planned_meal_id`, `p_group_key smallint`, `p_ingredient_ids uuid[]` | `void` | "Hoy uso cerdo"; arreglo vacío = automático. Errores: `choice_blocked`, `too_many_choices`, `too_few_choices` |
| `scale_planned_meal` | `p_planned_meal_id` | igual que `scale_recipe` | Ingredientes de una comida del plan (con sus elecciones) |
| `save_generated_plan` | `p_start date`, `p_end date`, `p_meals jsonb`, `p_budget_limit numeric?` | `uuid` (plan) | Guarda el plan de `generate-plan` en una transacción; reemplaza el borrador de esas fechas (`plan_overlap_confirmed` si hay uno confirmado) |

`p_meals`: `[{meal_date, slot, recipe_id, servings?, reason_code?, reason_ingredient_id?, choices?: [{group_key, ingredient_id}]}]`.

`p_choices` (en `preview_recipe`, `cook_now`, `cook_planned_meal`): `[{group_key, ingredient_id}]`, un elemento por ingrediente elegido; vacío = el sistema elige con la despensa. Se ignoran las opciones que no son de la receta o que chocan con las restricciones.

## Perfil, receta y cocinar (Sprints 2–3)
| Función | Parámetros | Devuelve | Uso | Migración |
|---|---|---|---|---|
| `set_my_restrictions` | `p_allergen_ids smallint[]`, `p_diet_ids smallint[]` | `void` | Reemplaza alergias y dietas en una transacción (onboarding y perfil). Exige autorización de datos sensibles (trigger) | `20261014000100` |
| `set_my_cuisines` | `p_cuisine_ids smallint[]` | `void` | Cocinas favoritas (US-138); el plan las prefiere | `20261015000100` |
| `preview_recipe` | `p_recipe_id`, `p_servings numeric`, `p_choices jsonb='[]'` | `jsonb` | Receta escalada con las opciones elegidas, costo y nutrición, sin guardar nada. Errores: `invalid_servings`, `recipe_not_found` | `20261014000200` |
| `cook_now` | `p_recipe_id`, `p_slot meal_slot`, `p_servings numeric`, `p_choices jsonb` | `jsonb` | "Cocinar ahora" fuera del plan: **suma un plato adicional** (`is_extra`) al día, sin reemplazar lo planeado, y descuenta despensa (ADR-028) | `20261113000500` |
| `cook_planned_meal` | `p_planned_meal_id`, `p_choices jsonb='[]'` | `jsonb` | Cocinar una comida del plan: guarda las opciones elegidas y llama a `mark_meal_cooked`. Error: `meal_not_found` | `20261014000300` |
| `rate_meal` | `p_planned_meal_id`, `p_rating smallint`, `p_tags text[]='{}'`, `p_comment text?` | `uuid` | Calificar después de cocinar (US-128); afecta el plan. Errores: `meal_not_cooked`, `already_rated` | `20261014000500` |

## Plan, compras y presupuesto (Sprints 4–5 y F2)
| Función | Parámetros | Devuelve | Uso | Migración |
|---|---|---|---|---|
| `generate_plan` | `p_start date=hoy`, `p_days int=7` (1–31: hoy, semana o mes), `p_slots meal_slot[]` | `uuid` (plan) | Arma el plan con reglas en SQL (ADR-018, ADR-023): solo recetas elegibles y prefiere las que usan lo que vence pronto y lo que hay en la despensa, las bien calificadas, las de cocinas favoritas y las que se acercan a la meta de proteína; el motivo (`reason_code`) lo pone la regla, nunca un LLM. Errores: `invalid_days`, `invalid_slots`, `no_eligible_recipes` | última versión en `20261113000500` |
| `move_checked_to_pantry` | `p_list_id uuid` | `int` (ítems movidos) | Lo comprado pasa a la despensa (US-126). Lo escrito a mano se busca en el catálogo (sin tildes ni plurales) y entra con la cantidad habitual de compra; si no está, queda como alimento propio; lo que no es comida solo se cierra (ADR-033). Error: `list_not_found` | última versión en `20261114000500` |
| `add_ingredients_to_list` | `p_list_id uuid`, `p_items jsonb` (`[{ingredient_id, grams}]`) | `int` (agregados) | Lo que falta de una receta o de "Para completar más recetas", como ingredientes con sus gramos: suma si ya estaba, no duplica lo que pide el plan (ADR-033). Errores: `list_not_found`, `invalid_quantity` | `20261114000500` |
| `suggest_substitutes_for` | `p_ingredient_ids uuid[]` | `ingredient_id, substitute_id, substitute_name, ratio, note, in_pantry` | Sustitutos seguros para varios ingredientes a la vez (US-147) | `20261015000200` |
| `substitute_shopping_item` | `p_item_id uuid`, `p_substitute_id uuid` | `void` | Cambiar un ítem de la lista por su sustituto. Error: `not_substitutable` | `20261015000200` |
| `undo_shopping_substitution` | `p_item_id uuid` | `void` | Volver al ingrediente original | `20261015000200` |
| `record_purchase` | `p_total numeric`, `p_list_id uuid?`, `p_store text?` | `uuid` | Registrar cuánto se pagó (US-141). Errores: `invalid_amount`, `list_not_found` | `20261111000100` |
| `monthly_spend` | `p_month date=hoy (Bogotá)` | `month_start, spent, purchases, monthly_budget, percent` | Gasto del mes contra el presupuesto (US-141) | `20261111000100` |
| `plan_savings` | `p_plan_id uuid`, `p_limit int=5` | `planned_meal_id, meal_date, slot, current_*, alternative_*, saving` | Reemplazos más baratos y seguros, uno por alternativa y sin días seguidos (US-152). Errores: `region_required`, `plan_not_found` | `20261111000100` |

## Nutrición, avisos y fallas (F2)
| Función | Parámetros | Devuelve | Uso | Migración |
|---|---|---|---|---|
| `daily_nutrition` | `p_date date=hoy (Bogotá)` | `planned_meal_id, slot, title, status, kcal, protein_g, carbs_g, fat_g` | "Mi día" (US-159); la meta de proteína (US-136) es dato sensible y exige autorización (`sensitive_authorization_required`) | `20261111000200` |
| `register_push_device` | `p_token text` | `void` | Guarda el token de Expo Push del teléfono (US-148). Error: `invalid_push_token` | `20261112000200` |
| `unregister_push_device` | `p_token text` | `void` | Se llama al cerrar sesión | `20261112000200` |
| `report_app_error` | `p_error_name`, `p_message`, `p_stack?`, `p_screen?`, `p_app_version?`, `p_device_model?`, `p_anonymous_id uuid?` | `void` | Registro de fallas propio (US-122, ADR-026): el texto se limpia en la app y otra vez en un trigger (correos, tokens JWT, UUID y números de 6 o más dígitos); límite de 30 por dispositivo y 1000 en total por hora | `20261112000100` |

**Tareas programadas (pg_cron, esquema `private`, no son RPC):** `dispatch_error_alert` cada 5 min → Edge Function `error-alert`; `schedule_notifications` cada 15 min y `dispatch_notifications` cada 5 min → Edge Function `send-notifications`. Ver `02-arquitectura/edge-functions.md`.
