# Plan de construcción

> Antes de empezar, lee `plan-de-arranque.md`: refuerzos a la especificación (migración `…001200_hardening`), sprints del MVP y lo que debe proveer el equipo.

Orden = fases; dentro de cada fase, el orden del backlog (`rank` en `05-historias-de-usuario/indice.md`) respetando dependencias. Una historia solo empieza si sus dependencias están hechas.

## Fase 0 — Fundaciones y validación (8 historias)
1. Repo, monorepo, `AGENTS.md`, CI básico (lint, tsc, `backend/supabase/tests/run.sh`). **US-102**.
2. Tres proyectos Supabase (dev/staging/prod); `supabase db push`; ejecutar `tests/run_remote.sh` en un proyecto desechable para confirmar compatibilidad real. **US-102**.
3. Configurar Auth (correo+contraseña, reglas de contraseña, verificación de correo, plantillas es-CO).
4. Cargar textos legales revisados en `legal_documents` (hash) y verificar `private.legal_readiness()`. **US-113, US-114**.
5. App esqueleto Expo Router, i18n, supabase-js, TanStack Query, Sentry con scrubbing, tema/accesibilidad.
6. **US-104** Registro/ingreso (ver M01). **US-105** verificación documentada de cifrado/TLS/RLS.
7. Spikes: **US-103** (motor de recomendación y costo por usuario → ADR), **US-112** (fuente de precios → ADR). **US-101** validar prototipo con usuarios.
**Salida F0:** un usuario puede registrarse con consentimientos, la CI despliega a staging, y hay decisiones sobre motor y precios.

## Fase 1 — MVP (24 historias)
Secuencia sugerida (cada bloque cierra con pruebas E2E Maestro del flujo):
1. **Datos:** importadores de nutrición/recetas/precios, catálogo inicial publicado (**US-110**, **US-111**, **US-121**; precios según US-112). Permiso ICBF antes de usar TCAC.
2. **Perfil:** onboarding dieta/alergias/presupuesto/porciones (**US-106–109**, con autorización de datos sensibles), editar perfil (**US-116**).
3. **Receta:** detalle, escalado, nutrición (**US-118**, **US-115**).
4. **Plan:** Edge Function `generate-plan` (**US-117**), cambiar comida (**US-129**), costos y presupuesto (**US-120**, **US-127**, **US-132**).
5. **Cocinar y despensa:** **US-119**, **US-123**.
6. **Compras:** **US-124**, **US-125**, **US-126** (con cola offline).
7. **Feedback:** **US-128**, **US-134**.
8. **Derechos del titular:** **US-133** (`export_my_data`, `delete-account`).
9. **Lanzamiento:** **US-158** (EAS, fichas de tienda, política de privacidad enlazada, pruebas cerradas).
**Puerta de salida:** 0 incidentes de alérgenos en pruebas, todos los criterios de F1 en verde, `legal_readiness()` listo, evaluación de impacto hecha.

## Fase 2 — Mejora y retención (27)
Bloques: observabilidad (US-122, 131, 150), accesibilidad (US-140), personalización (130, 136–139, 145, 146), nutrición (143, 159), compras/despensa (135, 142, 160), notificaciones (148, 149, 153; Edge Function `send-notifications`), asistente (155, 157, `assistant-chat`), presupuesto (141, 152), sustitutos (147), escalado no lineal (156), soporte (151), comentarios (144 — requiere decidir alcance de comunidad).

## Fase 3 — Después (14)
Comunidad (167–169, con `community_sharing` 154), batch/picante (170, 171), variantes (172), asistente rápido (173), y brechas de integraciones (161–166) que exigen migraciones y ADR.

## Estrategia de pruebas
| Nivel | Herramienta | Qué cubre |
|---|---|---|
| BD | `backend/supabase/tests` (SQL, 148 aserciones) | RLS, reglas, RPC, consentimientos. Añadir pruebas por cada migración |
| Unitarias | Jest | utilidades, esquemas Zod, hooks |
| Componentes | RNTL | formularios, estados vacío/error, accesibilidad |
| Edge Functions | `deno test` con LLM simulado | validación, fallback, cuota |
| E2E | Maestro | registro→onboarding→plan→compras→cocinar |
| Seguridad | pruebas de RLS con 2 usuarios; revisión de logs | ningún dato ajeno visible |
| Contenido | script que verifica que ninguna receta publicada viola alergias declaradas en perfiles de prueba | seguridad alimentaria |

## Definición de hecho por fase
Todas las historias de la fase en "Hecho" + criterios de la puerta de salida + CI verde + documentación de módulos actualizada.

## Riesgos principales
Costo/latencia del LLM (US-103) · calidad de datos de precios (US-112) · permiso ICBF · revisión legal · compatibilidad real con Supabase (probar temprano) · límite de bloqueo de intentos en Auth.
