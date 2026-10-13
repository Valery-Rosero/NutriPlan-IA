# Arquitectura

## Vista general
```
App móvil (Expo RN + TS)
  ├─ supabase-js (anon key + JWT del usuario) ──► PostgREST / RPC  ──► Postgres 16 (RLS en 59 tablas)
  ├─ Auth (correo + contraseña) ───────────────► Supabase Auth ──► trigger private.handle_new_user
  ├─ functions.invoke ─────────────────────────► Edge Functions (Deno/TS)
  │                                                 ├─ generate-plan ──► LLM (salida estructurada) ──► validación en BD
  │                                                 ├─ assistant-chat ─► LLM
  │                                                 ├─ delete-account ─► auth.admin.deleteUser (service_role)
  │                                                 └─ send-notifications ◄─ pg_cron ──► Expo Push API
  ├─ Storage (imágenes de recetas) ────────────► Supabase Storage
  └─ Sentry (sin datos de salud), analytics_events (anónimo)
```
## Principios
1. **Lógica de negocio en la base de datos** (RPC `SECURITY INVOKER` que respetan RLS) → una sola fuente de verdad, fácil de probar.
2. **El LLM solo en Edge Functions**, con salida estructurada validada; el modelo propone y la BD valida (alergias/dietas filtradas en SQL con `eligible_recipes`).
3. **Derivar en vez de almacenar:** alérgenos y dietas de receta, nutrición por porción, picante, batch cooking vienen de vistas.
4. **Cantidades canónicas en gramos** + escalado `qty = base × (porciones/base)^scaling_exponent`.
5. **Privado vs público:** helpers en esquema `private`; vistas `security_invoker`.
6. **Tres entornos** Supabase (dev / staging / prod), migraciones con `supabase db push` desde CI.

## Stack
| Capa | Tecnología |
|---|---|
| Móvil | Expo SDK vigente, React Native, TypeScript estricto, Expo Router, EAS Build/Update |
| Estado | TanStack Query (+ persistencia para caché offline), Zustand mínimo para estado de UI |
| Formularios | React Hook Form + Zod |
| Backend | Supabase: Postgres 16, Auth, Storage, Edge Functions (Deno), pg_cron |
| IA | Proveedor LLM vía Edge Function (clave en secretos de Supabase) |
| Notificaciones | Expo Notifications + Expo Push API |
| Observabilidad | Sentry (con scrubbing), `analytics_events` propio |
| CI/CD | GitHub Actions → EAS + `supabase db push` |
| Pruebas | Jest + React Native Testing Library, pruebas SQL (`tests/`), Maestro E2E |

## Flujos críticos
**Registro:** app lee `legal_documents` vigentes (lectura anónima) → `signUp` con ids + `is_adult:true` → trigger crea `profiles`, `notification_preferences`, `user_consents` → verificación de correo → onboarding. Autorización de datos sensibles: `accept_consent(id)` antes de escribir salud/alergias/dietas/condiciones.

**Generar plan:** app → `generate-plan` (JWT) → función lee perfil + `eligible_recipes()` por slot → LLM ordena/elige IDs dentro del conjunto → valida (todos los IDs ∈ conjunto, presupuesto, tiempo) → escribe `meal_plans(draft)` + `planned_meals` con `reason_code` → registra `ai_generations` → responde. Fallback determinista si el LLM falla.

**Cocinar:** `mark_meal_cooked` descuenta despensa (primero lo que vence antes) y devuelve resumen; `undo_meal_cooked` dentro de 10 s.

**Lista de compras:** `generate_shopping_list(plan)` suma comidas no cocinadas, resta despensa vigente; casillas sincronizan con cola offline.

**Borrado de cuenta:** `delete-account` → `auth.admin.deleteUser` → cascadas FK; `export_my_data` para portabilidad antes.
