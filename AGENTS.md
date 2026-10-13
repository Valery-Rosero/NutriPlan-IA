# AGENTS.md — Reglas para la IA que construye NutriPlan AI

Léelo completo antes de escribir una línea de código. Si algo contradice otro documento, **este archivo gana**, y luego `08-decisiones/`.

## 1. Qué estás construyendo
App móvil (Expo/React Native + TypeScript) con backend Supabase que genera planes de comida semanales personalizados, recetas, lista de compras, despensa, presupuesto y un asistente de IA, para usuarios adultos en Colombia (es-CO, COP). Contexto en `docs/00-vision-y-alcance/`. Foco: familias que no saben qué cocinar con lo que tienen (recetas versátiles, ADR-020).

## 2. Orden de lectura
0. `docs/07-plan-de-construccion/plan-de-arranque.md` (estado actual y siguientes pasos) → 1. `README.md` → 2. `docs/00-vision-y-alcance/vision.md` → 3. `docs/01-producto/limitaciones.md` (qué NO existe) → 4. `docs/02-arquitectura/arquitectura.md` y `convenciones.md` → 5. `docs/03-datos/` → 6. `docs/07-plan-de-construccion/plan.md` → 7. el módulo `docs/04-modulos/Mxx.md` y las historias `docs/05-historias-de-usuario/` que vayas a implementar. La app vive en `app/` (Expo SDK 57; lee también `app/AGENTS.md`).

## 3. Reglas innegociables (seguridad del usuario primero)
1. **Alergias y dietas son filtros duros, en SQL.** Nunca confíes en el LLM para excluir alérgenos. El LLM solo **ordena/propone dentro** del conjunto devuelto por `eligible_recipes()`. Toda sugerencia del LLM se revalida en BD (`apply_assistant_suggestion`, validadores de generate-plan).
2. **Nunca calcules cantidades, calorías, costos ni escalado en el cliente.** Usa `scale_recipe`, `recipe_cost`, `plan_budget_status`, `generate_shopping_list`. Una sola fuente de verdad.
3. **Nunca crees `profiles` desde la app.** Lo hace el trigger `private.handle_new_user` al registrarse. El registro DEBE enviar `privacy_policy_document_id`, `terms_document_id` e `is_adult:true` en `options.data`.
4. **La app nunca habla con el LLM.** Solo Edge Functions, con salida estructurada y validada (Zod) y con la `service_role` fuera del cliente. Jamás pongas `service_role` ni claves de LLM en el bundle de la app.
5. **Datos de salud/alergias/dietas = datos sensibles.** No se escriben en logs, Sentry, analytics ni mensajes de error. `analytics_events` solo guarda eventos anónimos sin contenido de salud. No hay captura de datos sensibles sin `sensitive_data_authorization` vigente (la BD lo impone; la UI debe pedirlo antes, y permitir revocarlo).
6. **Solo mayores de 18.** No hay perfiles de menores ni fecha de nacimiento (solo `birth_year`).
7. **Todo cambio de esquema es una migración nueva** en `backend/supabase/migrations/` (nunca editar las ya aplicadas). Toda tabla nueva lleva RLS + pruebas. Corre `backend/supabase/tests/run_local.sh` (Supabase local en Docker) antes de cada commit de backend; debe estar en verde (243 verificaciones al 13-oct-2026, en dos fases: reglas con `tests/fixtures.sql` y catálogo real con `catalog/`).
8. **No inventes datos nutricionales ni precios.** Los precios del piloto son estimados y se marcan como tal (`is_estimated`). Todo aviso de salud (`04_aviso_salud`) debe mostrarse donde la spec lo indique; la app no da diagnóstico ni tratamiento.
9. **Accesibilidad desde el día 1:** etiquetas de accesibilidad, contraste AA, tamaños táctiles ≥44pt, soporte de fuente grande, nada comunicado solo por color.
10. **Textos y fechas en es-CO**, moneda COP sin decimales en UI. Todo texto visible sale de i18n (`es-CO.json`), nunca hardcodeado.
11. **No uses funcionalidad marcada "BRECHA"** como si existiera: ver `01-producto/limitaciones.md`. Si la historia la requiere, primero abre una migración/ADR.

## 4. Cómo trabajar historia por historia
1. Elige la siguiente historia según `07-plan-de-construccion/plan.md` (fase → orden del backlog) cuyas dependencias estén "Hecho".
2. Lee su ficha en `05-historias-de-usuario/E*.md` (campos: criterios, backend, pantallas, reglas/límites, subtareas) y el módulo.
3. Escribe primero las pruebas de los criterios de aceptación (Given/When/Then → una prueba cada uno; los casos borde también).
4. Implementa. Mantén cambios pequeños; un PR por historia.
5. Verifica el DoD (abajo), marca el "Estado" en la ficha o en `historias.json` y avanza.
6. Si la spec es ambigua o contradictoria: **no adivines en silencio**. Elige la opción más segura, documéntala como ADR corto en `08-decisiones/` y sigue.

## 5. Definición de hecho (DoD global)
- [ ] Criterios de aceptación y casos borde cubiertos por pruebas automáticas que pasan.
- [ ] Lint, `tsc --noEmit` estricto, pruebas unitarias y de BD en verde en CI.
- [ ] Estados vacío / carga / error / sin conexión implementados.
- [ ] Accesibilidad verificada (lector de pantalla en los flujos tocados).
- [ ] Sin datos sensibles en logs/Sentry; sin secretos en el repo.
- [ ] RLS probada para cualquier tabla nueva o tocada.
- [ ] Textos en i18n; documentación del módulo actualizada si cambió el contrato.
- [ ] Migraciones en orden, aplican desde cero (`backend/supabase/tests/run_local.sh`).

## 6. Convenciones rápidas
Ver `02-arquitectura/convenciones.md` (estructura de carpetas, nombres, TanStack Query, Zod, tipos generados con `supabase gen types typescript`, Expo Router, Jest + RNTL, Maestro). Ante duda: simple, tipado, probado.
