# Reglas de negocio (ya impuestas en BD salvo indicación)

Códigos de error: los `raise exception 'codigo: texto'` empiezan con un código estable; la app los mapea a i18n.

## Cuenta y consentimientos
- Registro exige ids de `privacy_policy` y `terms` vigentes + `is_adult:true` → si no, `consent_required` / `adult_required`.
- `health_disclaimer`: la BD lo exige antes de guardar `user_conditions` (`health_disclaimer_required`); la app además lo muestra la primera vez que se genera un plan. `community_sharing`: obligatorio para publicar/comentar (`consent_required`). `sensitive_data_authorization`: obligatorio para escribir `profile_health`, `user_conditions`, `user_allergens`, `user_diets`; revocable (`revoke_consent`). Revocar `community_sharing` borra comentarios y despublica recetas propias (avisar antes).
- Versionado: `private.latest_legal_document(kind)`; `my_pending_consents` lista lo que falta (privacidad/términos siempre; salud/comunidad solo si ya aceptó versión anterior).
- `profiles.adult_declared_at` no se puede modificar. Se guarda `birth_year`, nunca fecha de nacimiento.

## Elegibilidad de recetas (`eligible_recipes`) — orden de filtros
1. `status='published'`. 2. Slot. 3. Tiempo total ≤ `p_max_minutes` o `max_cook_minutes` del perfil. 4. **Alergias (duro, incluye opcionales)** vía `private.recipe_conflicts_with_user`. 5. **Dietas (duro):** toda dieta del usuario debe estar en las dietas de la receta (derivadas de alérgenos/grupos excluidos). 6. Ingredientes que no le gustan (blando, ignora opcionales). 7. `heat_level` máx ≤ `spice_tolerance`. 8. Recetas calificadas ≤2★ en los últimos 60 días no vuelven. 9. Batch cooking: almuerzo/cena solo con `base_servings ≥ 4` y `keeps_days` definido.

## Publicación de recetas
- Para pasar a `published`: ≥1 ingrediente, ≥1 paso, **todos** los ingredientes con nutrición (`recipe_missing_nutrition`); oficial: última `nutritionist_reviews.outcome='approved'` (`review_required`); de comunidad: autor con `community_sharing` (`consent_required`).
- Una receta publicada no admite cambios de ingredientes: pasar a borrador primero (`recipe_published_locked`).
- 3 reportes de usuarios distintos: comentario → `hidden_at`; receta de comunidad publicada → `in_review`.

## Escalado y unidades
- `qty = base × (servings / base_servings)^scaling_exponent` (1 = lineal; especias <1). Unidades en `units` (masa/volumen/conteo); canónico en gramos con `ingredient_unit_weights` para conteo/volumen.
- Tiempos no escalan (limitación).

## Despensa, cocinar y compras
- `add_to_pantry` suma al lote del mismo ingrediente/unidad o crea uno. Vencidos no cuentan para compras ni cocina.
- `mark_meal_cooked`: marca `cooked`, descuenta despensa (FEFO: primero lo que vence antes) en `meal_pantry_deductions`, devuelve `{ deducted, short }`; `undo_meal_cooked` revierte dentro de 10 s.
- `generate_shopping_list(plan)`: suma comidas **no cocinadas**, resta despensa vigente, devuelve id de lista; mantiene ítems manuales.

## Presupuesto y precios
- `plan_budget_status` requiere región (`region_required`); devuelve costo estimado, límite (plan o perfil), exceso, `missing_prices` (sin precio) y `estimated_prices` (precios estimados). Mostrar siempre la etiqueta "estimado".

## Asistente
- Mensajes `assistant` pueden llevar sugerencia (`suggested_recipe_id`, `target_planned_meal_id`). `apply_assistant_suggestion` revalida elegibilidad y presupuesto, reemplaza la comida (`replaced_recipe_id`, `reason_code`) y marca `applied_at`; no se aplica dos veces.

## Comunidad
- Calificación 1–5 solo sobre comidas propias y de esa receta (`rating_mismatch`). Comentarios 1–1000 caracteres. Reporte: exactamente uno de comentario o receta.

## Soporte y analítica
- `support_tickets`: categoría bug/suggestion, mensaje 1–500. `analytics_events` (solo 4 tipos: `onboarding_completed`, `plan_generated`, `shopping_list_generated`, `meal_cooked`); agregar tipos exige migración del enum.

## Reglas pendientes de implementar en servidor/app
Cuota de IA por usuario; creación automática de `notifications`; límites de cooldown de contraseña; presupuesto antes de confirmar plan (UI usa `plan_budget_status`).

## Refuerzos (migración `20261013000100`)
- El trigger del plan valida alérgenos, **dietas** (`diet_conflict`) y tipo de comida (`slot_mismatch`). `my_plan_conflicts` incluye la columna `conflict` (`allergen` | `diet`).
- Publicar exige `ingredients.allergens_reviewed_at` en todos los ingredientes (base y opciones) (`allergens_unreviewed`) y al menos un tipo de comida.
- `accept_consent` solo acepta la versión vigente (`consent_outdated`).
- `undo_meal_cooked`: la ventana máxima la fija el servidor (15 s, aunque el cliente pida más).
- La base trabaja en `America/Bogota`: `current_date` es el día de Colombia.

## Recetas versátiles (migración `20261013000200`, ADR-020)
- Receta = base fija + grupos intercambiables (`recipe_flex_groups`, `recipe_flex_options`). Con k opciones elegidas en un grupo, cada una aporta `quantity / k`.
- Resolución por grupo: elección de la persona; si no hay, opción segura en despensa (la que vence antes primero), luego la que no le disgusta, luego la de por defecto. Grupo opcional (`min_choices = 0`): solo si está en la despensa.
- Elegibilidad: una receta se bloquea si la base tiene un alérgeno, si viola una dieta o si un grupo obligatorio no tiene opciones seguras suficientes.
- Una elección que choca con una alergia o dieta nueva se ignora y se resuelve con otra opción segura; no se puede volver a elegir (`choice_blocked`).
- Cambiar la receta de una comida borra sus elecciones. Cocinar congela la resolución (`is_auto`); deshacer la libera.
- Básicos (`is_staple`: sal, aceite, especias) cuentan como disponibles en "¿Qué cocino con lo que tengo?".
