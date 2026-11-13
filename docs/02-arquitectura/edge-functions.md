# Contratos de Edge Functions

Todas: Deno + TypeScript, validan entrada/salida con Zod, exigen `Authorization: Bearer <JWT>` (excepto `send-notifications` y `error-alert`, que solo invoca pg_cron con un secreto compartido y tienen `verify_jwt = false` en `config.toml`), responden JSON `{ ok: true, data } | { ok: false, error: { code, message } }`, no registran contenido de salud. Las fallas del servidor se registran con `_shared/report-error.ts` (ADR-026).

**Estado (12-nov-2026):** construidas y desplegadas en staging: `assistant-chat`, `delete-account`, `send-notifications`, `error-alert`. Nuevas, por desplegar: `categorize-food` (13-nov) y `understand-pantry` (14-nov); `assistant-chat` cambió (ADR-029) y hay que volver a desplegarla. `generate-plan` quedó reemplazada por la RPC `generate_plan` (ADR-023). Secretos: `backend/supabase/functions/.env.example` (los valores nunca van al repositorio).

## 1. `generate-plan`  (POST) — REEMPLAZADA por la RPC `generate_plan` (ADR-023)
> Se conserva como referencia. El plan se genera con reglas en SQL (`generate_plan(p_start, p_days, p_slots)` + `save_generated_plan`). Si más adelante se agrega un LLM para redactar explicaciones, irá en una Edge Function aparte que no decide recetas.

**Entrada:** `{ start_date: 'YYYY-MM-DD', days: 1..14 (def. 7), slots: meal_slot[], budget_limit?: number, servings?: number, pantry_first?: boolean, locked_meals?: [{date,slot,recipe_id}] }`
**Pasos:** 1) cargar perfil y preferencias (con el JWT del usuario, RLS); 2) por slot, `eligible_recipes(slot, max_minutes)`; 3) si `pantry_first`, ordenar con `recipe_pantry_match` y `recipes_using_expiring_ingredients`; 4) pedir al LLM un JSON `{ meals: [{date, slot, recipe_id, servings, reason_code}] }` usando SOLO ids del conjunto; 5) validar (ids ∈ elegibles, sin repetir más de N veces, costo ≤ presupuesto si se pide, tiempo); si falla, reintentar 1 vez y luego fallback determinista; 6) insertar `meal_plans(status=draft)` + `planned_meals`; 7) `ai_generations(kind='plan')`; 8) evento `plan_generated`.
**Salida:** `{ plan_id, meals: [...], cost: { estimated, budget_limit, over_by } }`.
**Errores:** `consent_required` (privacidad/términos pendientes), `no_eligible_recipes`, `quota_exceeded`, `llm_unavailable` (con fallback activado → `ok:true, data.fallback:true`).
**No funcional:** p95 < 20 s; límite de cuota diaria; idempotencia por `(user, start_date)` en borrador.

## 2. `assistant-chat`  (POST)
> **Recetas propias y varias opciones (ADR-029, 14-nov):** además del recetario, recibe `assistant_ingredients()` (ingredientes del catálogo que la persona puede comer, con qué hay en su cocina). El modelo devuelve `{ reply (Markdown), pantry_only, options: [{ kind: 'catalog', ref: 'R…' } | { kind: 'new', recipe }] }` con referencias cortas; `logic.ts` las valida y cada receta nueva se guarda con `rpc('create_assistant_recipe')` como la persona (la base revalida alergias, dieta, tiempo y cantidades). **Salida:** `{ conversation_id, message_id, reply, fallback, target_planned_meal_id, suggestions: [{ recipe_id, title, total_minutes, coverage, missing, by_assistant }], suggestion }` (`suggestion` = la primera, para versiones anteriores de la app). **Aplicar:** `rpc('apply_assistant_suggestion', { p_message_id, p_recipe_id })`. Salida del modelo hasta 2500 tokens, espera 15 s.
>
> **Construida** (ADR-025): Gemini con `responseSchema`; candidatas desde `cook_with_what_i_have` con el JWT (sin datos de salud en el prompt); respaldo determinista si el modelo falla; cuota 30/día. Lógica pura en `logic.ts`, probada con `npm run test:functions` (app/).
**Entrada:** `{ conversation_id?: uuid, message: string(≤1000), context?: { planned_meal_id? } }`
**Pasos:** crear/continuar `assistant_conversations`; guardar mensaje `user`; construir contexto mínimo (restricciones codificadas, plan actual); LLM con herramientas de solo lectura sobre RPC (`search_ingredients`, `suggest_substitutes`, `eligible_recipes`) y salida estructurada `{ reply, suggestion?: { recipe_id, target_planned_meal_id } }`; validar que `recipe_id` ∈ `eligible_recipes`; guardar mensaje `assistant` con `suggested_recipe_id/target_planned_meal_id`; `ai_generations(kind='chat'|'swap')`.
**Aplicar:** la app llama `rpc('apply_assistant_suggestion', {p_message_id})` (no la función).
**Salida:** `{ conversation_id, message_id, reply, suggestion? }`. **Límites:** historial enviado ≤ 10 mensajes; rechaza temas médicos/diagnóstico con respuesta de aviso.

## 3. `send-notifications`  (invocada por pg_cron cada 5–15 min)
> **Construida** (migración 20261112000200). Cambio frente a este contrato: la BASE decide qué y cuándo (`private.schedule_notifications` cada 15 min, `private.due_messages`, probado en SQL) y la función solo entrega por Expo Push con secreto compartido (`PUSH_SECRET`, `private.push_settings`); borra los tokens con `DeviceNotRegistered`. Horas de referencia: desayuno 7:00, almuerzo 12:30, algo 16:00, cena 20:00 (Colombia).
Selecciona `notifications` con `scheduled_for <= now() AND sent_at IS NULL` respetando `notification_preferences` y consentimientos; envía por Expo Push a `push_devices`; marca `sent_at`; elimina tokens inválidos (`DeviceNotRegistered`). Tipos: `meal_reminder`, `expiry_alert`, `weekly_summary`. Nunca incluye datos sensibles en el texto. Un trigger/cron adicional crea las filas (recordatorios de comidas planificadas, vencimientos ≤3 días, resumen semanal).

## 4. `delete-account`  (POST, JWT)
Reconfirma contraseña o token reciente → registra evento mínimo de auditoría sin PII → `auth.admin.deleteUser(user.id)` (service_role) → cascadas. Responde `{ ok:true }`; la app limpia caché local y cierra sesión. Idempotente.

## 5. Scripts de importación (no son funciones públicas)
`import-prices` (SIPSA/DANE → `ingredient_prices`, `is_estimated=true`, fuente citada), `import-nutrition` (USDA CC0 / TCAC tras permiso → `ingredient_nutrition`), `import-recipes` (curados → `recipes`, `recipe_ingredients`, `recipe_steps`, `nutritionist_reviews`). Corren desde CI o manualmente con `service_role`; deben ser idempotentes.

## 6. `error-alert`  (POST, secreto compartido; sin JWT)
**Construida** (ADR-026). La llama la base cada 5 minutos (`pg_cron` + `pg_net`) solo si hay fallas nuevas en `app_errors`, con un resumen ya limpio `{ total, groups: [{ source, error_name, message, times }] }`. Verifica el encabezado `x-alert-secret` contra `ALERT_SECRET` y envía el correo por Resend (`RESEND_API_KEY`, `ALERT_EMAIL`, `ALERT_FROM` opcional). Las demás funciones registran sus fallas con `_shared/report-error.ts`.

## 7. `categorize-food`  (POST, JWT) — B3, ADR-027
**Entrada:** `{ text: string }` (lo que escribió la persona; se normaliza a máximo 80 caracteres; menos de 2 letras → `invalid_input`).
**Orden:** caché `food_labels` → ingrediente del catálogo con el mismo nombre normalizado → Gemini (listas cerradas de `food_groups` e `ingredient_categories`, validado; se guarda en la caché y se registra en `ai_generations` con `kind = 'label'`, cuota 100/día por persona) → reglas (`logic.ts`).
**Salida:** `{ ok: true, data: { key, name, is_food, food_group_id, food_group, store_category_id, store_category, meal_slot, kcal_per_serving, protein_g_per_serving, source: 'cache' | 'catalog' | 'ai' | 'rules' } }`. Nunca falla por la IA: sin IA responde con reglas.
**Sin datos de salud.** No se usa para filtrar alergias. Lógica pura probada con `npm run test:functions` (app/); el adaptador de Gemini es compartido (`_shared/gemini.ts`).

## 8. `understand-pantry`  (POST, JWT) — ADR-030
**Entrada:** `{ text: string }` (2 a 300 caracteres): lo que la persona compró o tiene, escrito de corrido.
**Orden:** Gemini (catálogo como lista cerrada `I…`, salida estructurada, validada en `logic.ts`; cuota 40/día, `ai_generations.kind = 'pantry'`) → reglas (`rulesParse`).
**Salida:** `{ ok: true, data: { source: 'ai' | 'rules', items: [{ ingredient_id | null, name, quantity, unit, units, expires_in_days }] } }`. `units` = unidades válidas para guardarlo (catálogo: contables del ingrediente + masa; propio: las de un alimento propio). **No guarda nada:** la app muestra la lista para revisar y guarda lo marcado con `add_to_pantry` o como alimento propio.
**Sin datos de salud.** Lógica pura probada con `npm run test:functions` (app/).

