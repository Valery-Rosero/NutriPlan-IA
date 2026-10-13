# Funciones RPC públicas (`supabase.rpc`)

Todas `SECURITY INVOKER` (respetan RLS) salvo `export_my_data`. Requieren sesión (`authenticated`). Definidas en `backend/supabase/migrations/…0900_*` y `…1100_*`.

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

**Vistas útiles:** `my_pending_consents`, `my_plan_conflicts` (comidas futuras que chocan con alergias declaradas hoy), `my_monthly_spend`, `recipe_allergens`, `recipe_diets`, `recipe_max_heat`, `recipe_nutrition` (por porción), `recipe_rating_stats` (ver `modelo-de-datos.md`, sección Vistas).
**Cómo se prueba:** `backend/supabase/tests/run_local.sh` (Supabase local en Docker).
**RPC por construir (brechas):** `daily_nutrition(date)` (US-159).

## Recetas versátiles y plan (migración `20261013000200`, ADR-020)
| Función | Parámetros | Devuelve | Uso |
|---|---|---|---|
| `cook_with_what_i_have` | `p_slot meal_slot?`, `p_servings numeric?` (def. tamaño del hogar), `p_limit int=10` | `recipe_id, title, total_minutes, coverage, missing_count, missing jsonb, uses_expiring` | **Pantalla principal**: ¿qué cocino con lo que tengo? |
| `recipe_flex_menu` | `p_recipe_id`, `p_planned_meal_id?` | `group_key, group_label, min_choices, max_choices, ingredient_id, ingredient_name, in_pantry, is_default, selected` | Opciones seguras de cada grupo para la UI |
| `set_meal_choices` | `p_planned_meal_id`, `p_group_key smallint`, `p_ingredient_ids uuid[]` | `void` | "Hoy uso cerdo"; arreglo vacío = automático. Errores: `choice_blocked`, `too_many_choices`, `too_few_choices` |
| `scale_planned_meal` | `p_planned_meal_id` | igual que `scale_recipe` | Ingredientes de una comida del plan (con sus elecciones) |
| `save_generated_plan` | `p_start date`, `p_end date`, `p_meals jsonb`, `p_budget_limit numeric?` | `uuid` (plan) | Guarda el plan de `generate-plan` en una transacción; reemplaza el borrador de esas fechas (`plan_overlap_confirmed` si hay uno confirmado) |

`p_meals`: `[{meal_date, slot, recipe_id, servings?, reason_code?, reason_ingredient_id?, choices?: [{group_key, ingredient_id}]}]`.
