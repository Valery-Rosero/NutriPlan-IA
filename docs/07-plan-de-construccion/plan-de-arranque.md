# Plan de arranque del desarrollo

Fecha: 13 de octubre de 2026. Complementa a `plan.md` (fases y orden del backlog): aquí está **cómo se empieza**, qué hay que reforzar en la especificación antes de escribir la app y qué hace falta del equipo.

## Estado del Sprint 0 (13-oct-2026)
- [x] Monorepo `app/` + `backend/` + `docs/` (C4 resuelto: una sola copia de Supabase).
- [x] Las 11 migraciones originales aplican sobre **Supabase real** (local, Postgres 17); las pruebas pasan.
- [x] Migración `20261013000100_hardening.sql`: R1–R3, R5–R8. Runner multiplataforma `backend/supabase/tests/run_local.sh` (P2).
- [x] Migración `20261013000200_flexible_recipes.sql`: recetas versátiles (ADR-020) y guardado atómico del plan (R9).
- [x] 198 verificaciones SQL en verde (49 nuevas).
- [x] ADR-018 (plan con reglas), ADR-019 (límite de intentos), ADR-020 (recetas versátiles), ADR-021 (revisión asistida por IA).
- [x] App Expo SDK 57: Expo Router con grupos `(auth)` y `(tabs)`, sesión cifrada (SecureStore + AES), TanStack Query con caché sin conexión que solo guarda lo marcado, i18n es-CO, mapeo de errores, logger que redacta datos sensibles, tipos generados. `tsc`, lint, Jest y `expo-doctor` en verde; el bundle de Android compila.
- [x] CI (`.github/workflows/ci.yml`) y despliegue de migraciones a staging (`deploy-staging.yml`).
- [ ] Aplicar las migraciones a staging (`npx supabase db push` en `backend/`, o el workflow cuando exista el secreto `SUPABASE_ACCESS_TOKEN`).
- [ ] SMTP de Resend en el panel de staging (requiere dominio verificado en Resend).

## Estado del Sprint 1 (13-oct-2026)
- [x] Arquitectura de la app por capas con puertos y adaptadores (ADR-022).
- [x] US-104 Registro e inicio de sesión: contraseña ≥ 8 con mayúscula, minúscula y número; verificación de correo con reenvío; recuperación de contraseña; enlaces de correo con PKCE; correo ya registrado; freno de 5 intentos (ADR-019).
- [x] US-113 Casillas no premarcadas (18+, términos, política), aviso de privacidad visible, ids vigentes leídos al registrar; re-aceptación de versiones nuevas.
- [x] US-114 Aviso de salud aceptado antes de usar la app y pie fijo en Plan y Perfil.
- [x] US-105 Verificación documentada (`docs/02-arquitectura/verificacion-us105.md`); queda pendiente el plan con backups.
- [x] 64 pruebas de la app (dominio, adaptador, pantalla de registro con dobles) + prueba de humo contra Supabase Auth real.
- [ ] Prueba manual en el teléfono contra staging (requiere SMTP de Resend con dominio verificado).

## Estado del Sprint 2 (13-oct-2026)
- [x] Catálogo real (`backend/supabase/catalog/`): 52 ingredientes con nutrición de referencia USDA y alérgenos revisados, 16 recetas versátiles colombianas con grupos intercambiables. Es el seed del proyecto (`db push --include-seed`); las pruebas usan `tests/fixtures.sql`.
- [x] Prueba de contenido: para cada momento del día hay recetas para perfiles sin restricciones, veganos y con alergia a huevo, leche, gluten y pescado, y nunca se les resuelve un ingrediente prohibido.
- [x] US-106/107/108/109 Onboarding (máquina de estados): hogar y región (Pasto), autorización de datos sensibles, alergias y dietas (RPC `set_my_restrictions`), presupuesto.
- [x] US-116 Editar perfil reutilizando los formularios; revocar la autorización con advertencia R4.
- [x] US-130 "Completar después" y aviso permanente sin alergias declaradas.
- [x] US-119/US-142 Despensa: buscar sin tildes, cantidades en g, kg, libras o unidades, vencimientos rápidos, quitar.
- [x] 230 verificaciones SQL y 81 pruebas de la app en verde.

## Estado del Sprint 3 (13-oct-2026)
- [x] Detalle de receta: elegir opciones de cada grupo (solo las seguras), porciones de 1 a 12 (US-118), ingredientes escalados y marcados "lo tienes / falta", alérgenos, nutrición por porción (US-111, US-115), pasos.
- [x] RPC `preview_recipe` (todo se calcula en la base) y `cook_now`: cocinar sin plan previo, con deshacer de 10 s y faltantes (US-123).
- [x] US-121 cubierto por ADR-021 (revisión asistida por IA, visible en la app).
- [x] 243 verificaciones SQL y 101 pruebas de la app.

**Cambio de enfoque (ADR-020):** el producto se centra en familias que no saben qué cocinar con lo que tienen. La pantalla principal es "¿Qué cocino con lo que tengo?" (`cook_with_what_i_have`); el plan semanal se arma con las mismas recetas versátiles.

## 1. Diagnóstico de la especificación

**Lo que está bien y no se toca:** la arquitectura (Expo + Supabase, el LLM propone y la BD dispone), el modelo 3FN, RLS en todas las tablas, consentimientos versionados con hash, las 73 historias con criterios Dado/Cuando/Entonces y los ADR. Es una base mejor que la de la mayoría de proyectos que empiezan.

**Lo que hay que reforzar:** se revisaron las 11 migraciones contra las reglas de `AGENTS.md`. Hay huecos donde el SQL no cumple lo que la especificación promete, contradicciones entre documentos y supuestos que fallan en un Supabase real o en Windows.

### 1.1 Seguridad alimentaria e integridad (migración nueva `…001200_hardening.sql`)

| # | Hallazgo | Dónde | Riesgo | Refuerzo |
|---|---|---|---|---|
| R1 | El trigger `planned_meals_validate` revisa **alérgenos** pero **no dietas**. `AGENTS.md` dice que ambas son filtros duros. | `0600` | Un cambio manual (US-129, que hace UPDATE directo), el asistente o un script pueden poner carne en el plan de un vegano o gluten en una dieta sin gluten. | Agregar al trigger la verificación de dietas (misma lógica que `eligible_recipes`) con error `diet_conflict`. |
| R2 | `apply_assistant_suggestion` solo depende del trigger. La especificación dice que "revalida elegibilidad y presupuesto". | `0900` | La sugerencia del LLM se aplica aunque sea de otro slot, exceda el tiempo o la dieta (ver R1). | Exigir que la receta esté en `eligible_recipes(slot)` de la comida destino; devolver el estado del presupuesto. |
| R3 | **Sin dato = seguro:** un ingrediente sin filas en `ingredient_allergens` se trata como libre de alérgenos. | `0400` | Un error de carga de datos (olvidar marcar "trigo" con gluten) hace pasar recetas peligrosas por todos los filtros. | Columna `ingredients.allergens_reviewed_at`; `enforce_recipe_publishable` rechaza recetas con ingredientes sin revisión de alérgenos (`allergens_unreviewed`). |
| R4 | Revocar la autorización de datos sensibles **borra las alergias**, y los planes siguientes ya no las filtran. | `1100` | Es correcto por ley, pero la persona puede no entender la consecuencia. | En la UI, confirmación explícita ("tus próximos planes NO filtrarán alergias") y un banner permanente en Plan mientras no haya alergias declaradas (ya lo pide US-130). |
| R5 | El trigger no valida que la receta sirva para el slot (`recipe_meal_slots`). | `0600` | Un desayuno puede terminar en la cena; es menor, pero rompe el plan. | Incluirlo en el mismo trigger (`slot_mismatch`). |
| R6 | `undo_meal_cooked(p_window)` recibe la ventana desde el cliente. | `0900` | Cualquiera puede deshacer pasado el plazo enviando `p_window = '1 year'`. | Limitar con `least(p_window, interval '10 seconds')`. |
| R7 | `accept_consent` y la política de inserción de `user_consents` aceptan **versiones viejas** de un documento. | `1100`, `0800` | Se puede registrar el consentimiento a un texto que ya no está vigente. | Aceptar solo `private.latest_legal_document(kind)`. |
| R8 | Fechas con `current_date` en la zona horaria de la base (UTC). | varias | Entre las 7 p. m. y la medianoche de Colombia, "hoy" ya es mañana: vencimientos, conflictos de plan y fechas de compra quedan corridos un día. | `alter database postgres set timezone to 'America/Bogota'` (Colombia no tiene horario de verano). |
| R9 | Guardar un plan generado son varias llamadas a PostgREST (plan + 21 comidas): no hay transacción. | `generate-plan` | Si falla a la mitad queda un plan a medias que, además, bloquea la semana por `meal_plans_no_overlap`. | RPC `save_generated_plan(p_start, p_end, p_meals jsonb)` (`SECURITY INVOKER`) que en una sola transacción reemplaza el borrador de esas fechas e inserta todo. Da la idempotencia que pide el contrato. |

Todos se implementan en **una migración nueva** con sus pruebas, sin editar las existentes (regla 7 de `AGENTS.md`).

### 1.2 Supuestos que fallan en Supabase real o en Windows

| # | Hallazgo | Refuerzo |
|---|---|---|
| P1 | Si el trigger de registro lanza `consent_required`, Supabase Auth **no devuelve ese código**: responde un error genérico 500 ("Database error saving new user"). | Validar casillas y versión vigente en la app antes de `signUp`; mapear el error genérico a un mensaje i18n. El trigger queda como red de seguridad. |
| P2 | `tests/pg.sh` y `run.sh` solo funcionan en Linux (`su postgres`, `/usr/lib/postgresql`). | Runner nuevo con Supabase CLI + Docker (`supabase start` → `supabase db reset` → pruebas SQL). Funciona igual en Windows, Mac y CI, y además prueba sobre el Supabase real y no sobre el stub. Portar a pgTAP después. |
| P3 | El SMTP por defecto de Supabase solo envía a los correos del equipo del proyecto y con un límite muy bajo por hora. | SMTP propio (Resend o Brevo, plan gratuito) antes de que entren usuarios de prueba. |
| P4 | El plan gratuito de Supabase permite 2 proyectos activos y los pausa por inactividad; el ADR-016 pide 3 entornos. | **dev = Supabase local en Docker**, staging y prod = proyectos en la nube. Cumple el ADR sin pagar. |
| P5 | "5 intentos → bloqueo de 15 min" (US-104) no existe en Supabase Auth. | ADR corto: límites de tasa de Auth + CAPTCHA (Turnstile/hCaptcha, soportados por Supabase) en lugar de bloqueo por cuenta. Evita construir un login propio. |
| P6 | No hay buckets ni políticas de Storage, ni `pg_cron`/`pg_net` en las migraciones. | Se agregan en F2, cuando lleguen fotos de recetas, capturas de soporte y notificaciones. No bloquea el MVP. |

### 1.3 Contradicciones entre documentos (resolver con ADR)

| # | Contradicción | Propuesta |
|---|---|---|
| C1 | Latencia del plan: US-117 pide ≤5 s p95; `edge-functions.md` dice p95 < 20 s; `limitaciones.md`, tope de 30 s. | **ADR-018:** el plan se arma con ranking determinista (SQL + TypeScript) y cumple ≤5 s. El LLM solo entra para explicaciones o desempates, con timeout de 4 s y fallback. Así se cumple US-117 y baja el costo de IA. Lo confirma el spike US-103. |
| C2 | Quién asigna `reason_code`: el contrato de `generate-plan` lo pide al LLM; US-155 dice que lo asigna el motor de reglas, "nunca el LLM". | Lo asignan las reglas (US-155 gana: el motivo debe ser verdadero). |
| C3 | `NutriPlan AI — Stack y arquitectura de datos.md` (raíz) dice 9 migraciones, 123 pruebas y 14 funciones; el paquete dice 11, 148 y 16. | El documento raíz quedó viejo; manda el paquete. Marcarlo como histórico. |
| C4 | `nutriplan-supabase/` y `backend/supabase/` son copias idénticas. | Una sola fuente: `backend/supabase/` dentro del repositorio. |
| C5 | `AGENTS.md` pide marcar el "Estado" de cada historia, pero `historias.json` no tiene ese campo. | Llevar el estado en el tablero (GitHub Projects o Jira, ya existe el CSV de importación), no en el JSON. |
| C6 | Proveedor de LLM sin decidir. | Proponer Claude (Anthropic) detrás de la interfaz propia: un modelo pequeño y barato para explicaciones del plan y uno mayor para el asistente (F2). Se decide en el spike US-103 con costo medido por plan. |

## 2. Estructura del repositorio

```
nutriplan-ai/                      ← repo git (GitHub, privado)
├─ AGENTS.md  CLAUDE.md  README.md
├─ docs/                           ← este paquete de especificaciones (00-… 08-, referencias/)
├─ app/                            ← Expo (Expo Router, TS estricto)
├─ backend/
│  └─ supabase/                    ← config.toml, migrations/, seed.sql, tests/, functions/
├─ scripts/                        ← importadores (precios, nutrición, recetas)
└─ .github/workflows/              ← ci.yml, deploy-staging.yml, deploy-prod.yml
```

Supabase CLI se usa con `--workdir backend`. `docs/` conserva todo tal cual; las rutas internas de los documentos se ajustan una sola vez.

## 3. Plan por sprints (MVP = F0 + F1)

Sprints de 1 semana; las fechas exactas se fijan cuando se conozca la entrega final. Cada sprint termina con algo demostrable.

### Sprint 0 — Arranque técnico (sin pantallas de producto)
1. Crear el repo con la estructura de arriba; unificar las carpetas duplicadas (C4).
2. `supabase init` + `supabase start` (Docker) → `supabase db reset` aplica las 11 migraciones y el seed **sobre Supabase real local**. Correr las 148 aserciones con el runner nuevo (P2). Corregir lo que falle: es la primera prueba fuera del stub.
3. Migración `…001200_hardening.sql` con R1–R3 y R5–R9 + pruebas nuevas (incluido "ninguna receta publicada viola las alergias de perfiles de prueba").
4. ADR-018 (C1), ADR-019 (P5) y nota de C2.
5. App esqueleto: Expo Router con grupos `(auth)`, `(onboarding)` y `(tabs)`; supabase-js con `expo-secure-store`; TanStack Query con persistencia; i18n `es-CO.json`; tema con contraste AA; `logger` que descarta datos sensibles; tipos generados con `supabase gen types`.
6. CI en GitHub Actions: lint, `tsc --noEmit`, Jest y pruebas de BD con Supabase CLI.

**Salida:** `supabase db reset` + pruebas en verde localmente y en CI; la app abre en el teléfono y lee `legal_documents`.

### Sprint 1 — Cuenta y consentimientos (US-104, US-113, US-114, US-105)
Registro con casillas no premarcadas (18+, términos, política), verificación de correo, inicio de sesión, recuperar contraseña, pantalla de consentimientos pendientes y aviso de salud. Staging enlazado y desplegando migraciones desde CI. US-105 se entrega como verificación documentada (TLS, RLS, backups).

### Sprint 2 — Onboarding y perfil (US-106 a US-109, US-116, base de US-130)
Pantalla de autorización de datos sensibles (facultativa y revocable, con la advertencia de R4), dieta, alergias con buscador (`search_ingredients`), presupuesto, porciones, región, edición de perfil y conflictos (`my_plan_conflicts`).

### Sprint 3 — Catálogo y receta (US-110, US-111, US-121, US-115, US-118)
Importador de recetas curadas con revisión nutricional y de alérgenos (R3); importador de nutrición (USDA CC0; TCAC solo con permiso del ICBF). Detalle de receta con escalado (`scale_recipe`), nutrición por porción y el aviso de salud al pie. **Requiere el contenido de la sección 4.**

### Sprint 4 — Plan semanal (US-103, US-117, US-129, US-112, US-120, US-127, US-132)
Spike US-103 (motor y costo) y US-112 (precios SIPSA de la región piloto). Edge Function `generate-plan` con ranking determinista, fallback y cuota en `ai_generations`, guardado atómico con `save_generated_plan` (R9). Cambiar comida, costo estimado con la etiqueta "estimado" y alerta de presupuesto.

### Sprint 5 — Despensa, cocinar y compras (US-119, US-123, US-124, US-125, US-126)
Despensa con unidades y vencimiento, "Cocinar" con deshacer de 10 s y faltantes, lista de compras desde el plan descontando la despensa, ítems manuales y cola offline de casillas (ADR-014).

### Sprint 6 — Feedback, derechos del titular y lanzamiento (US-128, US-134, US-133, US-158)
Calificar después de cocinar (y que afecte las recomendaciones), exportar datos, Edge Function `delete-account`, E2E con Maestro (registro → onboarding → plan → compras → cocinar), build de EAS y prueba cerrada en tienda.

**Puerta de salida del MVP** (de `plan.md`): 0 incidentes de alérgenos, criterios F1 en verde, `legal_readiness()` listo y evaluación de impacto hecha.

Después del MVP sigue F2 según `plan.md`: asistente, notificaciones, analítica y accesibilidad ampliada.

## 4. Lo que el equipo debe proveer (no lo puede hacer la IA)

### Antes del Sprint 0
- [ ] **GitHub:** crear el repositorio privado (o autorizar a crearlo) y definir quién revisa los PR.
- [ ] **Docker Desktop** abierto mientras se trabaja (ya está instalado); con él corre Supabase local.
- [ ] **Equipo y fechas:** cuántas personas, roles, fecha de entrega final y duración de los sprints.

### Supabase (antes del Sprint 1)
- [ ] Crear la organización y **dos proyectos**: `nutriplan-staging` y `nutriplan-prod`, región **South America (São Paulo)**, la más cercana a Colombia. Guardar la contraseña de la base en un gestor de contraseñas, **no** en el chat ni en el repo.
- [ ] Correr `npx supabase login` y `npx supabase link --project-ref <ref> --workdir backend` (abren el navegador, así que debe hacerlo una persona).
- [ ] Pasar el **Project URL** y la **anon/publishable key** de staging (son públicas, van en la app). La `service_role` key **nunca** se comparte: va solo en los secretos de Supabase y de GitHub.
- [ ] En GitHub › Settings › Secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD_STAGING`, `SUPABASE_PROJECT_REF_STAGING` (y los de prod después).
- [ ] Auth en el panel: confirmación de correo activa, contraseña mínima de 8 con mayúsculas y números, protección de contraseñas filtradas, URL de redirección `nutriplan://` y **SMTP propio** (P3).
- [ ] **No crear tablas a mano en el panel.** Todo entra por migraciones (`supabase db push`); un cambio manual rompe la reproducibilidad.

### Para la IA del plan (Sprint 4)
- [ ] Cuenta en el proveedor de LLM (propuesta: Anthropic), API key cargada como secreto de Edge Functions (`supabase secrets set …`) y un **tope de gasto mensual** configurado en la consola del proveedor.

### Contenido (lo más lento: empezar ya, en paralelo)
- [ ] **Ciudad piloto** (los datos de ejemplo usan Pasto › Nariño › Colombia): confirmarla.
- [ ] **40 a 60 recetas** propias o con permiso, con ingredientes en cantidades, pasos, porciones, tiempo y slots, cubriendo omnívoro, vegetariano, vegano, sin gluten y sin lactosa.
- [ ] Un **nutricionista titulado** (o docente del área) que apruebe recetas y **etiquetas de alérgenos** (US-121, R3).
- [ ] Solicitud de **permiso escrito al ICBF** para la tabla TCAC; mientras tanto se usa USDA (CC0).

### Para publicar (Sprint 6)
- [ ] Cuenta de **Expo/EAS** (gratuita).
- [ ] Decidir plataformas: **Android** (Google Play, US$25 una vez) y/o **iOS** (Apple Developer, US$99/año). Propuesta: Android con prueba cerrada para el piloto.
- [ ] Cuenta de **Sentry** (plan gratuito).
- [ ] Decidir el alcance legal: piloto académico con textos marcados "borrador" o revisión real de un abogado antes de abrir a público (`checklist-cumplimiento.md`).

## 5. Riesgos del arranque

| Riesgo | Mitigación |
|---|---|
| El contenido (recetas, alérgenos, precios) no llega a tiempo | Empezar la sección 4 ya; el Sprint 3 depende de eso, no del código |
| Las migraciones fallan en Supabase real (nunca se probaron fuera del stub) | Es lo primero del Sprint 0 |
| Alcance: 73 historias es mucho para un semestre | Comprometer F0 + F1 (32 historias); F2 y F3 son extensiones |
| Costo y latencia del LLM | ADR-018: el plan no depende del LLM; cuota diaria en `ai_generations` |
