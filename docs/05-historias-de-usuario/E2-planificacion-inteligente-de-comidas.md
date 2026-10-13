# E2 · Planificación inteligente de comidas

Product Goal: Que cada usuario deje de improvisar qué cocinar y planifique su semana de comidas respetando su salud, sus gustos y su presupuesto.

Genera, ajusta y explica los planes de comidas diarios y semanales: motor de recomendación, escalado de porciones, adaptación de recetas, asistente conversacional y recordatorios.

17 historias · 16 subtareas.

| ID | Título | Módulo | Fase | Prio |
|---|---|---|---|---|
| [US-103](#us-103) | Spike: validar la arquitectura del motor de recomendación | M04 | F0 | High |
| [US-110](#us-110) | Disponer de un catálogo inicial de recetas variado y compatible con cada dieta | M03 | F1 | High |
| [US-117](#us-117) | Generar plan de comidas semanal automático | M04 | F1 | High |
| [US-118](#us-118) | Escalar porciones de una receta con recálculo automático | M03 | F1 | High |
| [US-123](#us-123) | Marcar una comida como cocinada | M04 | F1 | High |
| [US-129](#us-129) | Cambiar una comida del plan por una alternativa | M04 | F1 | High |
| [US-139](#us-139) | Generar plan solo para hoy | M04 | F2 | Medium |
| [US-146](#us-146) | Evitar repetir proteína principal en días consecutivos | M04 | F2 | Medium |
| [US-147](#us-147) | Sugerir sustitutos de ingredientes según restricciones | M03 | F2 | Medium |
| [US-148](#us-148) | Recordatorio de la próxima comida | M09 | F2 | Medium |
| [US-149](#us-149) | Configurar frecuencia de notificaciones | M09 | F2 | Medium |
| [US-155](#us-155) | Mostrar motivo de cada receta sugerida | M04 | F2 | Medium |
| [US-156](#us-156) | Manejar ingredientes no lineales al escalar porciones | M03 | F2 | Medium |
| [US-157](#us-157) | Cambiar una comida mediante el asistente conversacional | M05 | F2 | Medium |
| [US-160](#us-160) | Armar comida solo con ingredientes de la despensa (asistente) | M05 | F2 | Medium |
| [US-172](#us-172) | Ofrecer «versión rápida» de una receta | M03 | F3 | Low |
| [US-173](#us-173) | Respuestas rápidas en el chat del asistente | M05 | F3 | Low |

---

<a id="us-103"></a>
### US-103 · Spike: validar la arquitectura del motor de recomendación

| Campo | Valor |
|---|---|
| ID | US-103 (id Jira 103) |
| Épica | E2 · Planificación inteligente de comidas |
| Módulo | [M04 · Motor de planificación](../04-modulos/M04.md) |
| Fase | F0 Fundaciones y validación |
| Prioridad | High (orden en backlog: #3 de 73) |
| Tipo | spike |
| Etiquetas | plan-de-comidas, mvp, spike, agregada-por-po |
| Ref. backlog | HU-03 · Subárea: Plan de comidas |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** equipo de desarrollo
- **quiero** validar la arquitectura del motor de recomendación (reglas, ranking y modelo de lenguaje) y su costo por usuario
- **para** decidir qué construir antes de comprometer el plan semanal.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado un timebox de 3 días
   - Cuando termina el spike
   - Entonces existe un documento con la arquitectura recomendada y una prueba de concepto que genera un plan de 7 días respetando 5 perfiles de prueba (incluyendo uno con alergia a frutos secos y uno vegano), junto con el costo estimado por plan generado.

- **Caso borde:** si el costo por plan supera el umbral acordado con el Product Owner antes de iniciar, el documento propone al menos 2 alternativas para reducirlo.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** Entregable: ADR + prueba de concepto de la Edge Function `generate-plan` (reglas SQL + ranking + LLM) con 5 perfiles de prueba y costo por plan.
- **Pantallas / UI:** —
- **Reglas, límites y notas:** Timebox de 3 días. Partir de la arquitectura ya decidida: el modelo propone SOLO entre candidatos que devuelve `eligible_recipes`; la base valida.
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-110"></a>
### US-110 · Disponer de un catálogo inicial de recetas variado y compatible con cada dieta

| Campo | Valor |
|---|---|
| ID | US-110 (id Jira 110) |
| Épica | E2 · Planificación inteligente de comidas |
| Módulo | [M03 · Catálogo de recetas e ingredientes](../04-modulos/M03.md) |
| Fase | F1 MVP |
| Prioridad | High (orden en backlog: #10 de 73) |
| Tipo | historia |
| Etiquetas | recetas, mvp, agregada-por-po |
| Ref. backlog | HU-10 · Subárea: Recetas |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** encontrar desde el primer día recetas variadas que respeten mi dieta y mis alergias
- **para** no encontrarme con resultados vacíos ni repetidos.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado el catálogo cargado
   - Cuando se ejecuta la validación automática
   - Entonces el 100% de las recetas tiene ingredientes con cantidad y unidad normalizadas, porciones base, tiempo de preparación y al menos una etiqueta de dieta, y ninguna receta con alérgenos mayores carece de su etiqueta de alérgeno.

- **Caso borde:** el catálogo incluye al menos 20 recetas aptas por cada dieta soportada (omnívoro, vegetariano, vegano, sin gluten, sin lactosa) para que el filtrado nunca devuelva listas vacías.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** Tablas `ingredients`, `ingredient_nutrition`, `ingredient_prices`, `recipes`, `recipe_ingredients`, `recipe_steps`, `recipe_meal_slots`, `recipe_diet_tags`; flujo borrador → revisión → publicada.
- **Pantallas / UI:** Back-office (carga) y todas las pantallas de receta
- **Reglas, límites y notas:** Carga con script de importación, nunca con `seed.sql` (solo desarrollo). Fuentes con licencia verificada (ver 06-legal). Meta MVP: cubrir cada dieta soportada con variedad por franja. Publicar exige ingredientes, pasos, nutrición completa y revisión aprobada (triggers).
- **Pruebas existentes:** tests/20 (reglas de publicación)

**Subtareas**

- [ ] (1031) Definir el esquema de datos de receta (ingredientes, unidades, etiquetas)
- [ ] (1032) Cargar y normalizar las 150 recetas iniciales
- [ ] (1033) Crear el script de validación automática del catálogo
- [ ] (1034) Verificar cobertura mínima de 20 recetas por dieta soportada

**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-117"></a>
### US-117 · Generar plan de comidas semanal automático

| Campo | Valor |
|---|---|
| ID | US-117 (id Jira 117) |
| Épica | E2 · Planificación inteligente de comidas |
| Módulo | [M04 · Motor de planificación](../04-modulos/M04.md) |
| Fase | F1 MVP |
| Prioridad | High (orden en backlog: #17 de 73) |
| Tipo | historia |
| Etiquetas | plan-de-comidas, mvp |
| Ref. backlog | HU-17 · Subárea: Plan de comidas |
| Dependencias | US-110, US-107, US-103 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** recibir un plan de comidas semanal generado automáticamente
- **para** no tener que decidir qué cocinar cada día.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que mi perfil tiene dieta, alergias y presupuesto completos
   - Cuando toco "Generar plan semanal"
   - Entonces se generan 21 comidas (7 días x 3 comidas), 0 de ellas viola mis alergias o dieta, el tiempo de generación es ≤5 segundos en el 95% de las mediciones, y el costo total estimado se muestra junto al presupuesto declarado.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** Edge Function `generate-plan` (contrato en 02-arquitectura/edge-functions.md): `eligible_recipes` → ranking → (LLM opcional para explicaciones) → INSERT en `meal_plans` y `planned_meals` con `reason_code`; trigger `planned_meals_validate`; `plan_budget_status` para el costo.
- **Pantallas / UI:** Plan (generar), Inicio
- **Reglas, límites y notas:** Objetivo ≤5 s p95. Si el LLM falla o tarda, el plan se genera igual solo con reglas y ranking (degradación elegante). Registrar uso en `ai_generations` (solo service role). Plan máximo 14 días (check); sin traslape (`meal_plans_no_overlap`).
- **Pruebas existentes:** tests/40 (plan, traslape, trigger de alergia)

**Subtareas**

- [ ] (1055) Diseñar UX/UI: Generar plan de comidas semanal automático
- [ ] (1056) Implementar lógica y API: Generar plan de comidas semanal automático
- [ ] (1057) Construir interfaz en la app: Generar plan de comidas semanal automático
- [ ] (1058) Pruebas de aceptación: Generar plan de comidas semanal automático

**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-118"></a>
### US-118 · Escalar porciones de una receta con recálculo automático

| Campo | Valor |
|---|---|
| ID | US-118 (id Jira 118) |
| Épica | E2 · Planificación inteligente de comidas |
| Módulo | [M03 · Catálogo de recetas e ingredientes](../04-modulos/M03.md) |
| Fase | F1 MVP |
| Prioridad | High (orden en backlog: #18 de 73) |
| Tipo | historia |
| Etiquetas | recetas, mvp |
| Ref. backlog | HU-18 · Subárea: Recetas |
| Dependencias | US-110 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** cambiar el número de porciones de una receta y que las cantidades de ingredientes se recalculen automáticamente
- **para** (no declarado en el backlog original; inferir del criterio de aceptación)

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que una receta base para 4 porciones lleva 200g de garbanzos
   - Cuando cambio a 6 porciones
   - Entonces la cantidad se recalcula a 300g (factor 1.5) en menos de 200ms, y la información nutricional se multiplica por el mismo factor.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** RPC `scale_recipe(recipe_id, servings)` devuelve cantidad, unidad y gramos por ingrediente.
- **Pantallas / UI:** Receta (selector de porciones)
- **Reglas, límites y notas:** El cliente NO calcula cantidades: muestra lo que devuelve la función. Mínimo `greatest(paso, …)`: nada escala a cero.
- **Pruebas existentes:** tests/20 (lineal, x0.5, sublineal)

**Subtareas**

- [ ] (1059) Diseñar UX/UI: Escalar porciones de una receta con recálculo automático
- [ ] (1060) Implementar lógica y API: Escalar porciones de una receta con recálculo automático
- [ ] (1061) Construir interfaz en la app: Escalar porciones de una receta con recálculo automático
- [ ] (1062) Pruebas de aceptación: Escalar porciones de una receta con recálculo automático

**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-123"></a>
### US-123 · Marcar una comida como cocinada

| Campo | Valor |
|---|---|
| ID | US-123 (id Jira 123) |
| Épica | E2 · Planificación inteligente de comidas |
| Módulo | [M04 · Motor de planificación](../04-modulos/M04.md) |
| Fase | F1 MVP |
| Prioridad | High (orden en backlog: #23 de 73) |
| Tipo | historia |
| Etiquetas | plan-de-comidas, mvp, agregada-por-po |
| Ref. backlog | HU-23 · Subárea: Plan de comidas |
| Dependencias | US-117, US-119 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** marcar una comida del plan como cocinada
- **para** llevar el registro de lo que realmente preparé.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado una comida planificada para hoy
   - Cuando toco "Marcar como cocinada"
   - Entonces la comida pasa a estado "cocinada" con la hora de registro, se descuentan de la despensa las cantidades de ingredientes usados y se abre el selector de calificación.

- **Caso borde:** si la despensa no tiene cantidad suficiente de un ingrediente, se descuenta hasta 0 sin quedar negativa y la acción no se bloquea; puedo deshacer la acción durante 10 segundos.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** RPC `mark_meal_cooked(planned_meal_id)` (descuenta despensa FIFO por vencimiento, sin negativos, informa faltantes) y `undo_meal_cooked(id)` (ventana 10 s).
- **Pantallas / UI:** Receta (cocinar ahora) → selector de calificación
- **Reglas, límites y notas:** La app muestra el `shortfall` devuelto, no bloquea. Deshacer falla si ya se calificó.
- **Pruebas existentes:** tests/40 (FIFO, faltantes, deshacer y plazo)

**Subtareas**

- [ ] (1079) Diseñar UX/UI: Marcar una comida como cocinada
- [ ] (1080) Implementar lógica y API: Marcar una comida como cocinada
- [ ] (1081) Construir interfaz en la app: Marcar una comida como cocinada
- [ ] (1082) Pruebas de aceptación: Marcar una comida como cocinada

**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-129"></a>
### US-129 · Cambiar una comida del plan por una alternativa

| Campo | Valor |
|---|---|
| ID | US-129 (id Jira 129) |
| Épica | E2 · Planificación inteligente de comidas |
| Módulo | [M04 · Motor de planificación](../04-modulos/M04.md) |
| Fase | F1 MVP |
| Prioridad | High (orden en backlog: #29 de 73) |
| Tipo | historia |
| Etiquetas | plan-de-comidas, mvp |
| Ref. backlog | HU-29 · Subárea: Plan de comidas |
| Dependencias | US-117 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** cambiar una comida específica del plan por una alternativa sugerida, sin regenerar todo el plan
- **para** (no declarado en el backlog original; inferir del criterio de aceptación)

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que estoy viendo la cena del jueves en mi plan semanal
   - Cuando toco "Cambiar"
   - Entonces se muestran entre 2 y 4 alternativas compatibles con mi perfil; al elegir una, solo esa celda del plan cambia y el resumen de calorías y gasto se recalcula sin refrescar el resto del plan.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** UPDATE de `planned_meals.recipe_id` guardando `replaced_recipe_id`; `eligible_recipes(slot)` para alternativas; validación por trigger.
- **Pantallas / UI:** Plan (cambiar comida)
- **Reglas, límites y notas:** Solo comidas en estado `planned`. La lista de compras y el presupuesto se recalculan después del cambio.
- **Pruebas existentes:** tests/40

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-139"></a>
### US-139 · Generar plan solo para hoy

| Campo | Valor |
|---|---|
| ID | US-139 (id Jira 139) |
| Épica | E2 · Planificación inteligente de comidas |
| Módulo | [M04 · Motor de planificación](../04-modulos/M04.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #39 de 73) |
| Tipo | historia |
| Etiquetas | plan-de-comidas |
| Ref. backlog | HU-39 · Subárea: Plan de comidas |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** poder pedir un plan solo
- **para** hoy en vez de la semana completa, para decisiones del día a día.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que estoy en la pantalla principal
   - Cuando toco "Plan de hoy"
   - Entonces se genera una sugerencia de desayuno/almuerzo/cena en menos de 3 segundos, usando como filtro adicional el tiempo disponible que declaré para hoy (si lo indiqué).

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `generate-plan` con `days=1` (plan de un día: `start_date = end_date`).
- **Pantallas / UI:** Inicio (plan para hoy)
- **Reglas, límites y notas:** 
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-146"></a>
### US-146 · Evitar repetir proteína principal en días consecutivos

| Campo | Valor |
|---|---|
| ID | US-146 (id Jira 146) |
| Épica | E2 · Planificación inteligente de comidas |
| Módulo | [M04 · Motor de planificación](../04-modulos/M04.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #46 de 73) |
| Tipo | historia |
| Etiquetas | plan-de-comidas |
| Ref. backlog | HU-46 · Subárea: Plan de comidas |
| Dependencias | US-117 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** que el plan no repita la misma proteína principal más de 2 veces seguidas
- **para** tener variedad.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que el almuerzo del lunes tiene pollo como proteína principal
   - Cuando se genera el almuerzo del martes
   - Entonces el martes no puede tener pollo como proteína principal; a partir del tercer día consecutivo sin esa proteína, puede volver a aparecer.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** Regla de ranking en `generate-plan` usando `recipes.main_protein_id`; no es restricción de base de datos.
- **Pantallas / UI:** —
- **Reglas, límites y notas:** Regla blanda: si no hay candidatas suficientes se permite repetir.
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-147"></a>
### US-147 · Sugerir sustitutos de ingredientes según restricciones

| Campo | Valor |
|---|---|
| ID | US-147 (id Jira 147) |
| Épica | E2 · Planificación inteligente de comidas |
| Módulo | [M03 · Catálogo de recetas e ingredientes](../04-modulos/M03.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #47 de 73) |
| Tipo | historia |
| Etiquetas | recetas |
| Ref. backlog | HU-47 · Subárea: Recetas |
| Dependencias | US-110 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario con alguna intolerancia leve
- **quiero** que la app me sugiera sustitutos de un ingrediente que no puedo comer dentro de una receta que me gusta
- **para** (no declarado en el backlog original; inferir del criterio de aceptación)

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que tengo intolerancia a la lactosa declarada y veo una receta con "leche" en sus ingredientes
   - Cuando abro el detalle
   - Entonces aparece un ícono de sustitución junto a "leche" que ofrece "leche de almendra" o "leche sin lactosa" validada contra mi restricción, con un toque para reemplazarla también en la lista de compras.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** RPC `suggest_substitutes(ingredient_id)` sobre `ingredient_substitutions`, filtrada por alérgenos y dietas del usuario.
- **Pantallas / UI:** Receta (sustituir ingrediente)
- **Reglas, límites y notas:** El filtro por restricciones del usuario se hace en la función, no en la app.
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-148"></a>
### US-148 · Recordatorio de la próxima comida

| Campo | Valor |
|---|---|
| ID | US-148 (id Jira 148) |
| Épica | E2 · Planificación inteligente de comidas |
| Módulo | [M09 · Notificaciones](../04-modulos/M09.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #48 de 73) |
| Tipo | historia |
| Etiquetas | notificaciones |
| Ref. backlog | HU-48 · Subárea: Notificaciones |
| Dependencias | US-117, US-123 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** recibir un recordatorio de cuál es mi próxima comida
- **para** no olvidarme del plan del día.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que tengo notificaciones activadas y una cena planificada a las 20:00
   - Cuando llegan las 19:30 (30 min configurable antes)
   - Entonces recibo una notificación push "Tu cena de hoy: [nombre receta]".

- **Caso borde:** si ya marqué esa comida como cocinada antes de las 19:30, la notificación no se envía.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `push_devices` (token de Expo), `notification_preferences.meal_reminder_lead_minutes`; Edge Function `send-notifications` por `pg_cron`; `notifications` con unicidad para no duplicar.
- **Pantallas / UI:** Ajustes de notificaciones
- **Reglas, límites y notas:** Pedir permiso de notificaciones en contexto, no al abrir.
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-149"></a>
### US-149 · Configurar frecuencia de notificaciones

| Campo | Valor |
|---|---|
| ID | US-149 (id Jira 149) |
| Épica | E2 · Planificación inteligente de comidas |
| Módulo | [M09 · Notificaciones](../04-modulos/M09.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #49 de 73) |
| Tipo | historia |
| Etiquetas | notificaciones |
| Ref. backlog | HU-49 · Subárea: Notificaciones |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** poder desactivar o ajustar la frecuencia de las notificaciones
- **para** que no se sientan invasivas.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que estoy en configuración de notificaciones
   - Cuando selecciono "Solo resumen semanal"
   - Entonces dejo de recibir recordatorios diarios de comida y en su lugar recibo un único resumen los domingos, aplicado desde la próxima notificación programada.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `notification_preferences.frequency` (enum) y `expiry_alerts_enabled`.
- **Pantallas / UI:** Ajustes de notificaciones
- **Reglas, límites y notas:** 
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-155"></a>
### US-155 · Mostrar motivo de cada receta sugerida

| Campo | Valor |
|---|---|
| ID | US-155 (id Jira 155) |
| Épica | E2 · Planificación inteligente de comidas |
| Módulo | [M04 · Motor de planificación](../04-modulos/M04.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #55 de 73) |
| Tipo | historia |
| Etiquetas | plan-de-comidas |
| Ref. backlog | HU-55 · Subárea: Plan de comidas |
| Dependencias | US-117 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** ver por qué se me sugirió cada receta
- **para** confiar más en las recomendaciones.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que una receta fue sugerida porque usa un ingrediente de mi despensa próximo a vencer
   - Cuando abro su detalle
   - Entonces veo una etiqueta con el motivo específico (ej. "Sugerida porque tu cilantro vence en 2 días"), nunca un texto genérico como "Recomendado para ti".

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `planned_meals.reason_code` → `recommendation_reasons`; `reason_ingredient_id` para «usa espinaca de tu despensa».
- **Pantallas / UI:** Plan (detalle de comida)
- **Reglas, límites y notas:** El motivo lo asigna el motor de reglas (verdadero siempre), no se inventa con el LLM.
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-156"></a>
### US-156 · Manejar ingredientes no lineales al escalar porciones

| Campo | Valor |
|---|---|
| ID | US-156 (id Jira 156) |
| Épica | E2 · Planificación inteligente de comidas |
| Módulo | [M03 · Catálogo de recetas e ingredientes](../04-modulos/M03.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #56 de 73) |
| Tipo | historia |
| Etiquetas | recetas |
| Ref. backlog | HU-56 · Subárea: Recetas |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** que cantidades no lineales (especias, tiempos de horno) no escalen de forma absurda al cambiar porciones
- **para** (no declarado en el backlog original; inferir del criterio de aceptación)

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que una receta marca "1 cucharadita de sal" como ingrediente no lineal
   - Cuando escalo de 4 a 12 porciones (factor 3)
   - Entonces la sal NO se multiplica linealmente a 3 cucharaditas, sino que se ajusta según la regla definida, dentro de un rango validado por un nutricionista.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `recipe_ingredients.scaling_exponent` (0-1); `scale_recipe` redondea al paso de la unidad o del ingrediente.
- **Pantallas / UI:** Receta
- **Reglas, límites y notas:** Fórmula: `cantidad = base × (porciones/base)^exponente`. Los tiempos de cocción NO se escalan en el MVP (limitación).
- **Pruebas existentes:** tests/20 (sublineal y redondeo)

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-157"></a>
### US-157 · Cambiar una comida mediante el asistente conversacional

| Campo | Valor |
|---|---|
| ID | US-157 (id Jira 157) |
| Épica | E2 · Planificación inteligente de comidas |
| Módulo | [M05 · Asistente IA](../04-modulos/M05.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #57 de 73) |
| Tipo | historia |
| Etiquetas | asistente-ia |
| Ref. backlog | HU-57 · Subárea: Asistente IA |
| Dependencias | US-129 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** pedirle al asistente en lenguaje natural que me cambie una comida del día
- **para** ajustar el plan sin navegar menús.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que escribo "cámbiame la cena, no quiero lentejas"
   - Cuando envío el mensaje
   - Entonces el asistente responde en menos de 2 segundos con una alternativa que NO contiene lentejas y un botón "Aplicar" que reemplaza la cena sin salir del chat.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** Edge Function `assistant-chat`; `assistant_conversations`/`assistant_messages` con `suggested_recipe_id` + `target_planned_meal_id`; RPC `apply_assistant_suggestion(message_id)`.
- **Pantallas / UI:** Asistente
- **Reglas, límites y notas:** La sugerencia es un dato tipado, no texto libre. El usuario confirma; aplicar pasa por las MISMAS validaciones que un cambio manual.
- **Pruebas existentes:** tests/40 (alergia rechazada, doble aplicación)

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-160"></a>
### US-160 · Armar comida solo con ingredientes de la despensa (asistente)

| Campo | Valor |
|---|---|
| ID | US-160 (id Jira 160) |
| Épica | E2 · Planificación inteligente de comidas |
| Módulo | [M05 · Asistente IA](../04-modulos/M05.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #60 de 73) |
| Tipo | historia |
| Etiquetas | asistente-ia |
| Ref. backlog | HU-60 · Subárea: Asistente IA |
| Dependencias | US-119, US-157 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** poder pedirle al asistente que arme mi próxima comida solo con lo que tengo en la despensa
- **para** (no declarado en el backlog original; inferir del criterio de aceptación)

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que escribo "arma algo solo con lo que tengo"
   - Cuando el asistente procesa el pedido
   - Entonces la receta devuelta usa el 100% de sus ingredientes principales desde mi despensa declarada, sin agregar ítems que requieran compra.

- **Caso borde:** si no es posible, responde explícitamente "no tengo una receta completa solo con tu despensa, te falta X" en vez de forzar una sugerencia incompleta.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `assistant-chat` usando `recipe_pantry_match` y `eligible_recipes`.
- **Pantallas / UI:** Asistente
- **Reglas, límites y notas:** Solo propone recetas publicadas y elegibles.
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-172"></a>
### US-172 · Ofrecer «versión rápida» de una receta

| Campo | Valor |
|---|---|
| ID | US-172 (id Jira 172) |
| Épica | E2 · Planificación inteligente de comidas |
| Módulo | [M03 · Catálogo de recetas e ingredientes](../04-modulos/M03.md) |
| Fase | F3 Después |
| Prioridad | Low (orden en backlog: #72 de 73) |
| Tipo | historia |
| Etiquetas | recetas |
| Ref. backlog | HU-72 · Subárea: Recetas |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario con poco tiempo
- **quiero** pedir una 'versión rápida' de una receta
- **para** reducir el tiempo de preparación.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que una receta tiene un tiempo estimado de 40 minutos
   - Cuando toco "Versión rápida"
   - Entonces se muestra una variante con tiempo estimado ≤25 minutos, señalando explícitamente qué pasos se combinaron o qué atajo se usó (ej. "salsa de tomate en lata en vez de tomates frescos").

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** BRECHA: el esquema no tiene variantes de receta. Opciones: tabla nueva `recipe_variants` o generación asistida validada por el trigger del plan.
- **Pantallas / UI:** Receta (botón «versión rápida»)
- **Reglas, límites y notas:** Requiere diseño previo (spike). No empezar sin decisión del PO.
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-173"></a>
### US-173 · Respuestas rápidas en el chat del asistente

| Campo | Valor |
|---|---|
| ID | US-173 (id Jira 173) |
| Épica | E2 · Planificación inteligente de comidas |
| Módulo | [M05 · Asistente IA](../04-modulos/M05.md) |
| Fase | F3 Después |
| Prioridad | Low (orden en backlog: #73 de 73) |
| Tipo | historia |
| Etiquetas | asistente-ia |
| Ref. backlog | HU-73 · Subárea: Asistente IA |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** usar respuestas rápidas predefinidas en el chat
- **para** no tener que escribir siempre mi pedido.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que abro el asistente por primera vez en el día
   - Cuando se carga la pantalla
   - Entonces se muestran exactamente 3 chips de pedidos frecuentes basados en mi historial de uso (ej. si suelo pedir "menos calorías", ese chip aparece primero).

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** Sin backend: chips de respuesta rápida predefinidos en la app que envían un mensaje al asistente.
- **Pantallas / UI:** Asistente
- **Reglas, límites y notas:** 
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---
