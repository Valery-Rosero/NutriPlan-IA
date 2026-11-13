# Arquitectura

## Vista general
```
App Android (Expo SDK 57, RN + TS)
  ├─ supabase-js (anon key + JWT del usuario) ──► PostgREST / RPC ──► Postgres 17 (RLS en las 64 tablas)
  │                                                 ├─ generate_plan (reglas en SQL, ADR-023)
  │                                                 └─ pg_cron ─┬─ cada 15 min: programa avisos ─┐
  │                                                             └─ cada 5 min: fallas nuevas ─┐   │
  ├─ Auth (correo + contraseña, PKCE) ─────────► Supabase Auth ──► SMTP de Gmail (plantillas es-CO)
  ├─ functions.invoke ─────────────────────────► Edge Functions (Deno/TS)                  │   │
  │                                                 ├─ assistant-chat ─► Gemini Flash-Lite   │   │
  │                                                 ├─ categorize-food ► caché → catálogo → Gemini → reglas
  │                                                 ├─ delete-account ─► auth.admin.deleteUser
  │                                                 ├─ error-alert ◄───────────────────────┘   │  ──► correo (Resend)
  │                                                 └─ send-notifications ◄────────────────────┘  ──► Expo Push ──► FCM
  ├─ Storage (capturas de pantalla de soporte) ► Supabase Storage (bucket privado)
  └─ report_app_error (fallas, sin datos de salud) · analytics_events (anónimo, con permiso)
```
## Principios
1. **Lógica de negocio en la base de datos** (RPC `SECURITY INVOKER` que respetan RLS) → una sola fuente de verdad, fácil de probar. Las pocas `SECURITY DEFINER` filtran por `auth.uid()` (ver `03-datos/funciones-rpc.md`).
2. **El plan se arma con reglas, no con un LLM** (ADR-018, ADR-023). El LLM solo vive en Edge Functions (el asistente), con salida estructurada; el modelo propone y la BD valida (alergias y dietas filtradas en SQL con `eligible_recipes`). Sin datos de salud en el prompt (ADR-025).
3. **Derivar en vez de almacenar:** alérgenos y dietas de receta, nutrición por porción, picante, batch cooking vienen de vistas.
4. **Cantidades canónicas en gramos** + escalado `qty = base × (porciones/base)^scaling_exponent`.
5. **Recetas versátiles** (ADR-020): base + grupos intercambiables que se resuelven con la despensa.
6. **Privado vs público:** helpers en esquema `private`; vistas `security_invoker`.
7. **Entornos:** local (Docker), staging y producción en Supabase (São Paulo); migraciones con `supabase db push` desde GitHub Actions.
8. **App por capas** (ADR-022): cada *feature* tiene `domain` / `data` / `application` / `ui`; los servicios se inyectan (`di/`), así las pruebas usan dobles.

## Stack
| Capa | Tecnología |
|---|---|
| Móvil | Expo SDK 57, React Native 0.86, TypeScript estricto, Expo Router (`Stack.Protected`), EAS Build. Solo Android |
| Estado | TanStack Query 5 (+ persistencia para caché sin conexión, `onlineManager`) |
| Formularios | React Hook Form + Zod 4 |
| Textos | i18next (`es-CO.json`) |
| Backend | Supabase: Postgres 17, Auth, Storage, Edge Functions (Deno), pg_cron, pg_net |
| IA | Google Gemini (`gemini-flash-lite-latest`) vía Edge Function; clave en secretos de Supabase (ADR-025) |
| Notificaciones | `expo-notifications` + Expo Push API + Firebase Cloud Messaging (FCM v1) |
| Correo | Auth: SMTP de Gmail con contraseña de aplicación. Alertas de fallas al equipo: Resend |
| Observabilidad | Registro de fallas propio (`app_errors`, ADR-026) + `analytics_events` anónimo (ADR-015) |
| CI/CD | GitHub Actions: CI (lint, tipos, Jest, pruebas SQL) y despliegue a staging (`db push` + funciones); APK con EAS |
| Pruebas | Jest + React Native Testing Library, pruebas SQL (`backend/supabase/tests`), integración contra Supabase real, lógica de Edge Functions (`npm run test:functions`), auditoría estática de accesibilidad |

## Flujos críticos
**Registro:** app lee `legal_documents` vigentes (lectura anónima) → `signUp` con ids + `is_adult:true` → trigger crea `profiles`, `notification_preferences`, `user_consents` → verificación de correo (enlace `nutriplan://`) → onboarding. Autorización de datos sensibles: `accept_consent(id)` antes de escribir salud/alergias/dietas/condiciones.

**Generar plan:** app → `rpc('generate_plan', {p_start, p_days, p_slots})` → por momento del día, `eligible_recipes()` y puntaje por reglas (lo que vence, despensa, calificaciones, meta de proteína, cocinas favoritas) → `save_generated_plan` escribe `meal_plans(draft)` + `planned_meals` con `reason_code`. Sin LLM en el camino crítico.

**Cocinar:** `cook_planned_meal` (o `cook_now` fuera del plan) guarda las opciones elegidas y llama a `mark_meal_cooked`, que descuenta despensa (primero lo que vence antes) y devuelve un resumen; `undo_meal_cooked` dentro de 10 s.

**Lista de compras:** `generate_shopping_list(plan)` suma comidas no cocinadas y resta despensa vigente; casillas con cola sin conexión; `move_checked_to_pantry` pasa lo comprado a la despensa; `record_purchase` registra el gasto.

**Asistente:** app → `assistant-chat` (JWT) → candidatas de `cook_with_what_i_have` con el JWT del usuario → Gemini elige y explica → la función valida que la receta sea elegible; si el modelo falla, respaldo determinista. Aplicar una sugerencia: `apply_assistant_suggestion`.

**Avisos:** `private.schedule_notifications` (cada 15 min) decide qué recordar según preferencias → `private.dispatch_notifications` (cada 5 min) llama a `send-notifications` → Expo Push. Los avisos solo nombran la comida o el ingrediente.

**Fallas:** la app limpia el error y llama `report_app_error`; un trigger vuelve a limpiar; `dispatch_error_alert` (cada 5 min) avisa por correo al equipo si hay fallas nuevas.

**Borrado de cuenta:** `delete-account` → `auth.admin.deleteUser` → cascadas FK; `export_my_data` para portabilidad antes.
