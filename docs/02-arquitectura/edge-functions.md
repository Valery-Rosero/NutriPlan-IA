# Contratos de Edge Functions

Todas: Deno + TypeScript, validan entrada/salida con Zod, exigen `Authorization: Bearer <JWT>` (excepto `send-notifications`, que solo invoca pg_cron con secreto), responden JSON `{ ok: true, data } | { ok: false, error: { code, message } }`, no registran contenido de salud. Estado: **por construir**.

## 1. `generate-plan`  (POST) — REEMPLAZADA por la RPC `generate_plan` (ADR-023)
> Se conserva como referencia. El plan se genera con reglas en SQL (`generate_plan(p_start, p_days, p_slots)` + `save_generated_plan`). Si más adelante se agrega un LLM para redactar explicaciones, irá en una Edge Function aparte que no decide recetas.

**Entrada:** `{ start_date: 'YYYY-MM-DD', days: 1..14 (def. 7), slots: meal_slot[], budget_limit?: number, servings?: number, pantry_first?: boolean, locked_meals?: [{date,slot,recipe_id}] }`
**Pasos:** 1) cargar perfil y preferencias (con el JWT del usuario, RLS); 2) por slot, `eligible_recipes(slot, max_minutes)`; 3) si `pantry_first`, ordenar con `recipe_pantry_match` y `recipes_using_expiring_ingredients`; 4) pedir al LLM un JSON `{ meals: [{date, slot, recipe_id, servings, reason_code}] }` usando SOLO ids del conjunto; 5) validar (ids ∈ elegibles, sin repetir más de N veces, costo ≤ presupuesto si se pide, tiempo); si falla, reintentar 1 vez y luego fallback determinista; 6) insertar `meal_plans(status=draft)` + `planned_meals`; 7) `ai_generations(kind='plan')`; 8) evento `plan_generated`.
**Salida:** `{ plan_id, meals: [...], cost: { estimated, budget_limit, over_by } }`.
**Errores:** `consent_required` (privacidad/términos pendientes), `no_eligible_recipes`, `quota_exceeded`, `llm_unavailable` (con fallback activado → `ok:true, data.fallback:true`).
**No funcional:** p95 < 20 s; límite de cuota diaria; idempotencia por `(user, start_date)` en borrador.

## 2. `assistant-chat`  (POST)
**Entrada:** `{ conversation_id?: uuid, message: string(≤1000), context?: { planned_meal_id? } }`
**Pasos:** crear/continuar `assistant_conversations`; guardar mensaje `user`; construir contexto mínimo (restricciones codificadas, plan actual); LLM con herramientas de solo lectura sobre RPC (`search_ingredients`, `suggest_substitutes`, `eligible_recipes`) y salida estructurada `{ reply, suggestion?: { recipe_id, target_planned_meal_id } }`; validar que `recipe_id` ∈ `eligible_recipes`; guardar mensaje `assistant` con `suggested_recipe_id/target_planned_meal_id`; `ai_generations(kind='chat'|'swap')`.
**Aplicar:** la app llama `rpc('apply_assistant_suggestion', {p_message_id})` (no la función).
**Salida:** `{ conversation_id, message_id, reply, suggestion? }`. **Límites:** historial enviado ≤ 10 mensajes; rechaza temas médicos/diagnóstico con respuesta de aviso.

## 3. `send-notifications`  (invocada por pg_cron cada 5–15 min)
Selecciona `notifications` con `scheduled_for <= now() AND sent_at IS NULL` respetando `notification_preferences` y consentimientos; envía por Expo Push a `push_devices`; marca `sent_at`; elimina tokens inválidos (`DeviceNotRegistered`). Tipos: `meal_reminder`, `expiry_alert`, `weekly_summary`. Nunca incluye datos sensibles en el texto. Un trigger/cron adicional crea las filas (recordatorios de comidas planificadas, vencimientos ≤3 días, resumen semanal).

## 4. `delete-account`  (POST, JWT)
Reconfirma contraseña o token reciente → registra evento mínimo de auditoría sin PII → `auth.admin.deleteUser(user.id)` (service_role) → cascadas. Responde `{ ok:true }`; la app limpia caché local y cierra sesión. Idempotente.

## 5. Scripts de importación (no son funciones públicas)
`import-prices` (SIPSA/DANE → `ingredient_prices`, `is_estimated=true`, fuente citada), `import-nutrition` (USDA CC0 / TCAC tras permiso → `ingredient_nutrition`), `import-recipes` (curados → `recipes`, `recipe_ingredients`, `recipe_steps`, `nutritionist_reviews`). Corren desde CI o manualmente con `service_role`; deben ser idempotentes.
