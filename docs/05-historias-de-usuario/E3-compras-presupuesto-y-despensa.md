# E3 · Compras, presupuesto y despensa

Product Goal: Que cada usuario deje de improvisar qué cocinar y planifique su semana de comidas respetando su salud, sus gustos y su presupuesto.

Convierte el plan de comidas en una lista de compras accionable, controla el gasto frente al presupuesto declarado, reduce el desperdicio de alimentos y prepara el terreno para foto/OCR e integraciones con supermercados.

19 historias · 8 subtareas.

| ID | Título | Módulo | Fase | Prio |
|---|---|---|---|---|
| [US-112](#us-112) | Spike: validar fuentes de precios de alimentos para la región piloto | M07 | F0 | High |
| [US-119](#us-119) | Gestionar ingredientes de la despensa (agregar, editar, eliminar) | M06 | F1 | High |
| [US-120](#us-120) | Estimar costos con precios promedio reales de mi región | M07 | F1 | High |
| [US-124](#us-124) | Generar lista de compras desde el plan semanal | M06 | F1 | High |
| [US-125](#us-125) | Excluir de la lista los ingredientes ya en despensa | M06 | F1 | High |
| [US-126](#us-126) | Marcar, eliminar y agregar ítems manualmente en la lista | M06 | F1 | High |
| [US-127](#us-127) | Mostrar costo estimado del plan semanal | M07 | F1 | High |
| [US-132](#us-132) | Alertar cuando el plan supera el presupuesto | M07 | F1 | High |
| [US-135](#us-135) | Organizar lista de compras por sección del supermercado | M06 | F2 | Medium |
| [US-141](#us-141) | Ver gasto acumulado mensual vs. presupuesto | M07 | F2 | Medium |
| [US-142](#us-142) | Registrar fecha de vencimiento de ingredientes | M06 | F2 | Medium |
| [US-152](#us-152) | Sugerir reemplazos para ajustar el plan al presupuesto | M07 | F2 | Medium |
| [US-153](#us-153) | Notificar ingredientes por vencer con recetas sugeridas | M06 | F2 | Medium |
| [US-161](#us-161) | Compartir lista de compras con otra persona | M06 | F3 | Low |
| [US-162](#us-162) | Sugerir recetas de aprovechamiento de sobras | M06 | F3 | Low |
| [US-163](#us-163) | Reconocer ingredientes desde una foto | M12 | F3 | Low |
| [US-164](#us-164) | Escanear recibo de compra con OCR | M12 | F3 | Low |
| [US-165](#us-165) | Mostrar precios actualizados según supermercado elegido | M12 | F3 | Low |
| [US-166](#us-166) | Enviar lista de compras como pedido al supermercado | M12 | F3 | Low |

---

<a id="us-112"></a>
### US-112 · Spike: validar fuentes de precios de alimentos para la región piloto

| Campo | Valor |
|---|---|
| ID | US-112 (id Jira 112) |
| Épica | E3 · Compras, presupuesto y despensa |
| Módulo | [M07 · Presupuesto y precios](../04-modulos/M07.md) |
| Fase | F0 Fundaciones y validación |
| Prioridad | High (orden en backlog: #12 de 73) |
| Tipo | spike |
| Etiquetas | presupuesto, mvp, spike, agregada-por-po |
| Ref. backlog | HU-12 · Subárea: Presupuesto |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** equipo de desarrollo
- **quiero** validar de dónde obtener precios promedio de alimentos confiables
- **para** la región piloto, para saber si la estimación de costos es viable.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado un timebox de 2 días
   - Cuando termina el spike
   - Entonces se documentan al menos 3 fuentes candidatas con su cobertura de los ingredientes del catálogo inicial, su frecuencia de actualización y sus condiciones de uso.

- **Caso borde:** si ninguna fuente cubre al menos el 80% de los ingredientes, se propone un plan de relevamiento propio con esfuerzo estimado.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** Entregable: filas en `price_sources` (con `license_notes`) y primer lote de `ingredient_prices` para la región piloto; informe de cobertura.
- **Pantallas / UI:** —
- **Reglas, límites y notas:** Seguir 06-legal/datos-y-licencias.md: USDA FDC (CC0) y DANE con cita; ICBF requiere permiso. SIPSA son precios mayoristas: marcar como estimados.
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-119"></a>
### US-119 · Gestionar ingredientes de la despensa (agregar, editar, eliminar)

| Campo | Valor |
|---|---|
| ID | US-119 (id Jira 119) |
| Épica | E3 · Compras, presupuesto y despensa |
| Módulo | [M06 · Compras y despensa](../04-modulos/M06.md) |
| Fase | F1 MVP |
| Prioridad | High (orden en backlog: #19 de 73) |
| Tipo | historia |
| Etiquetas | compras, mvp, agregada-por-po |
| Ref. backlog | HU-19 · Subárea: Compras |
| Dependencias | US-104 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** agregar, editar y eliminar ingredientes de mi despensa con su cantidad y unidad
- **para** que la app sepa qué tengo en casa.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que estoy en la pantalla Despensa
   - Cuando agrego "lentejas" con 500 g
   - Entonces el ítem aparece en mi inventario con cantidad y unidad y queda disponible para el cruce con listas de compras y el ranking de recetas.

- **Caso borde:** si agrego un ingrediente que ya existe con unidad compatible, la cantidad se suma (200 g + 300 g = 500 g) en vez de duplicar el ítem; si la unidad es incompatible (g vs unidades), se pide confirmar antes de guardar.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** RPC `add_to_pantry(ingredient, cantidad, unidad, vence)` (convierte a gramos; fusiona lotes iguales); CRUD sobre `pantry_items`.
- **Pantallas / UI:** Despensa
- **Reglas, límites y notas:** Unidades sin equivalencia en gramos se rechazan (`unit_incompatible`). Lotes: mismo ingrediente + mismo vencimiento = una fila.
- **Pruebas existentes:** tests/30 (despensa)

**Subtareas**

- [ ] (1063) Diseñar UX/UI: Gestionar ingredientes de la despensa (agregar, editar, eliminar)
- [ ] (1064) Implementar lógica y API: Gestionar ingredientes de la despensa (agregar, editar, eliminar)
- [ ] (1065) Construir interfaz en la app: Gestionar ingredientes de la despensa (agregar, editar, eliminar)
- [ ] (1066) Pruebas de aceptación: Gestionar ingredientes de la despensa (agregar, editar, eliminar)

**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-120"></a>
### US-120 · Estimar costos con precios promedio reales de mi región

| Campo | Valor |
|---|---|
| ID | US-120 (id Jira 120) |
| Épica | E3 · Compras, presupuesto y despensa |
| Módulo | [M07 · Presupuesto y precios](../04-modulos/M07.md) |
| Fase | F1 MVP |
| Prioridad | High (orden en backlog: #20 de 73) |
| Tipo | historia |
| Etiquetas | presupuesto, mvp, agregada-por-po |
| Ref. backlog | HU-20 · Subárea: Presupuesto |
| Dependencias | US-112, US-110 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** que los costos estimados se basen en precios promedio de mi región y muestren qué tan actualizados están
- **para** confiar en el presupuesto que veo.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado un ingrediente del catálogo y la región del usuario
   - Cuando se consulta su precio
   - Entonces se devuelve precio por unidad base (kg, L o unidad) en COP y la fecha de su última actualización; el 100% de los ingredientes del catálogo inicial tiene precio en la región piloto.

- **Caso borde:** si falta el precio regional, se usa el promedio nacional y el resultado se marca como "estimado".

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `ingredient_prices` (precio por kg, por región y fuente, con fecha) y `private.ingredient_price` con respaldo al ancestro (Pasto → Nariño → Colombia) marcando `is_estimated`.
- **Pantallas / UI:** Plan, Compras
- **Reglas, límites y notas:** La UI debe diferenciar precio exacto de estimado. Precios faltantes se cuentan en `missing_prices`, no se inventan.
- **Pruebas existentes:** tests/20 (respaldo regional)

**Subtareas**

- [ ] (1067) Cargar los precios de la región piloto en COP
- [ ] (1068) Implementar el servicio de consulta con respaldo de promedio nacional
- [ ] (1069) Marcar los precios estimados en la interfaz
- [ ] (1070) Verificar cobertura del 100% de los ingredientes del catálogo

**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-124"></a>
### US-124 · Generar lista de compras desde el plan semanal

| Campo | Valor |
|---|---|
| ID | US-124 (id Jira 124) |
| Épica | E3 · Compras, presupuesto y despensa |
| Módulo | [M06 · Compras y despensa](../04-modulos/M06.md) |
| Fase | F1 MVP |
| Prioridad | High (orden en backlog: #24 de 73) |
| Tipo | historia |
| Etiquetas | compras, mvp |
| Ref. backlog | HU-24 · Subárea: Compras |
| Dependencias | US-117 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** generar automáticamente la lista de compras a partir de mi plan semanal
- **para** no armarla manualmente.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado un plan semanal ya generado con 21 comidas
   - Cuando toco "Generar lista de compras"
   - Entonces los ingredientes que se repiten en 2 o más recetas aparecen como una sola línea con la suma exacta de cantidades (ej. "3 tazas de garbanzos" en vez de 3 líneas separadas).

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** RPC `generate_shopping_list(plan_id)` (idempotente; una lista por plan).
- **Pantallas / UI:** Compras
- **Reglas, límites y notas:** Respeta ítems ya marcados; retira los que ya no se necesitan.
- **Pruebas existentes:** tests/40 (lista de compras)

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-125"></a>
### US-125 · Excluir de la lista los ingredientes ya en despensa

| Campo | Valor |
|---|---|
| ID | US-125 (id Jira 125) |
| Épica | E3 · Compras, presupuesto y despensa |
| Módulo | [M06 · Compras y despensa](../04-modulos/M06.md) |
| Fase | F1 MVP |
| Prioridad | High (orden en backlog: #25 de 73) |
| Tipo | historia |
| Etiquetas | compras, mvp |
| Ref. backlog | HU-25 · Subárea: Compras |
| Dependencias | US-124, US-119 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** que los ingredientes que ya tengo en despensa no aparezcan como pendientes de comprar
- **para** (no declarado en el backlog original; inferir del criterio de aceptación)

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que tengo 200g de lentejas en despensa y el plan requiere 250g en total
   - Cuando se genera la lista de compras
   - Entonces el ítem "lentejas" aparece con cantidad neta a comprar = 50g.

- **Caso borde:** si la despensa cubre el 100% del requerimiento, el ítem aparece tachado con la nota "ya tienes esto" en vez de omitirse silenciosamente.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `shopping_list_items.pantry_g` (foto) y `to_buy_g` (columna generada = max(necesario − despensa, 0)).
- **Pantallas / UI:** Compras
- **Reglas, límites y notas:** Un ítem totalmente cubierto queda con `to_buy_g = 0` y se muestra aparte.
- **Pruebas existentes:** tests/40

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-126"></a>
### US-126 · Marcar, eliminar y agregar ítems manualmente en la lista

| Campo | Valor |
|---|---|
| ID | US-126 (id Jira 126) |
| Épica | E3 · Compras, presupuesto y despensa |
| Módulo | [M06 · Compras y despensa](../04-modulos/M06.md) |
| Fase | F1 MVP |
| Prioridad | High (orden en backlog: #26 de 73) |
| Tipo | historia |
| Etiquetas | compras, mvp |
| Ref. backlog | HU-26 · Subárea: Compras |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** tachar o eliminar ítems de la lista manualmente
- **para** ajustarla a mi realidad.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que estoy viendo mi lista de compras
   - Cuando toco el checkbox de un ítem
   - Entonces el ítem se tacha visualmente y se mueve al final de su sección; además puedo agregar un ítem libre mediante un campo de texto que no queda vinculado a ninguna receta.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** CRUD sobre `shopping_list_items` (`is_checked`, `custom_name`, `source` = plan|manual).
- **Pantallas / UI:** Compras
- **Reglas, límites y notas:** Ítems manuales usan `custom_name` y `store_category_id`; los de plan usan `ingredient_id`.
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-127"></a>
### US-127 · Mostrar costo estimado del plan semanal

| Campo | Valor |
|---|---|
| ID | US-127 (id Jira 127) |
| Épica | E3 · Compras, presupuesto y despensa |
| Módulo | [M07 · Presupuesto y precios](../04-modulos/M07.md) |
| Fase | F1 MVP |
| Prioridad | High (orden en backlog: #27 de 73) |
| Tipo | historia |
| Etiquetas | presupuesto, mvp |
| Ref. backlog | HU-27 · Subárea: Presupuesto |
| Dependencias | US-120, US-117 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** ver el costo estimado de mi plan semanal antes de ir a comprar
- **para** saber si se ajusta a mi presupuesto.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado un plan semanal generado
   - Cuando abro el resumen
   - Entonces veo el costo total estimado (suma de precio_promedio x cantidad por ingrediente) desglosado por receta, con la fuente y antigüedad del precio visible (ej. "precios promedio Nariño, actualizados hace 5 días").

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** RPC `recipe_cost(recipe, region, porciones)` y `plan_budget_status(plan)`.
- **Pantallas / UI:** Plan (encabezado con costo vs presupuesto)
- **Reglas, límites y notas:** Requiere `profiles.region_id`; sin región falla con `region_required`.
- **Pruebas existentes:** tests/40

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-132"></a>
### US-132 · Alertar cuando el plan supera el presupuesto

| Campo | Valor |
|---|---|
| ID | US-132 (id Jira 132) |
| Épica | E3 · Compras, presupuesto y despensa |
| Módulo | [M07 · Presupuesto y precios](../04-modulos/M07.md) |
| Fase | F1 MVP |
| Prioridad | High (orden en backlog: #32 de 73) |
| Tipo | historia |
| Etiquetas | presupuesto, mvp |
| Ref. backlog | HU-32 · Subárea: Presupuesto |
| Dependencias | US-127, US-108 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** que la app me avise si mi plan supera el presupuesto declarado, antes de confirmarlo
- **para** (no declarado en el backlog original; inferir del criterio de aceptación)

**Criterios de aceptación**

1. **Escenario 1**
   - Dado un presupuesto semanal de $60.000 y un plan con costo estimado de $68.000
   - Cuando intento confirmar el plan
   - Entonces aparece una alerta bloqueante "Tu plan cuesta $8.000 más de tu presupuesto" con las opciones "Ajustar automáticamente" y "Confirmar de todos modos"; no puedo avanzar sin elegir una.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `plan_budget_status.over_by > 0`.
- **Pantallas / UI:** Plan (banner de alerta)
- **Reglas, límites y notas:** La alerta se evalúa al generar, al cambiar comidas y al editar porciones.
- **Pruebas existentes:** tests/40 (exceso)

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-135"></a>
### US-135 · Organizar lista de compras por sección del supermercado

| Campo | Valor |
|---|---|
| ID | US-135 (id Jira 135) |
| Épica | E3 · Compras, presupuesto y despensa |
| Módulo | [M06 · Compras y despensa](../04-modulos/M06.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #35 de 73) |
| Tipo | historia |
| Etiquetas | compras |
| Ref. backlog | HU-35 · Subárea: Compras |
| Dependencias | US-124 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** que la lista esté organizada por sección del supermercado (verdulería, lácteos, despensa)
- **para** comprar más rápido.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado una lista de compras con 15 ítems de distintas categorías
   - Cuando se muestra la lista
   - Entonces los ítems se agrupan bajo mínimo 4 encabezados de sección; si arrastro un encabezado a otra posición, el nuevo orden se recuerda en la siguiente lista generada.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `ingredient_categories.sort_order`; ítem de plan hereda categoría del ingrediente.
- **Pantallas / UI:** Compras
- **Reglas, límites y notas:** 
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-141"></a>
### US-141 · Ver gasto acumulado mensual vs. presupuesto

| Campo | Valor |
|---|---|
| ID | US-141 (id Jira 141) |
| Épica | E3 · Compras, presupuesto y despensa |
| Módulo | [M07 · Presupuesto y precios](../04-modulos/M07.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #41 de 73) |
| Tipo | historia |
| Etiquetas | presupuesto |
| Ref. backlog | HU-41 · Subárea: Presupuesto |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** ver mi gasto acumulado del mes frente a mi presupuesto mensual
- **para** tomar decisiones informadas.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que registré compras durante el mes
   - Cuando abro la pantalla de despensa y gasto
   - Entonces veo gasto_acumulado/presupuesto_mensual con el porcentaje exacto (ej. "64% — $38.200 de $60.000"); si supera el 100%, la barra cambia a color de alerta.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** Vista `my_monthly_spend` sobre `purchases` y `purchase_items`.
- **Pantallas / UI:** Presupuesto (mensual)
- **Reglas, límites y notas:** `purchases.total_amount` es lo pagado realmente (independiente de la suma de ítems).
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-142"></a>
### US-142 · Registrar fecha de vencimiento de ingredientes

| Campo | Valor |
|---|---|
| ID | US-142 (id Jira 142) |
| Épica | E3 · Compras, presupuesto y despensa |
| Módulo | [M06 · Compras y despensa](../04-modulos/M06.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #42 de 73) |
| Tipo | historia |
| Etiquetas | desperdicio |
| Ref. backlog | HU-42 · Subárea: Desperdicio |
| Dependencias | US-119 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** registrar la fecha de vencimiento de los ingredientes de mi despensa
- **para** que la app me avise antes de que se echen a perder.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que agrego "cilantro" a mi despensa
   - Cuando completo el campo opcional de fecha de vencimiento
   - Entonces el ítem aparece en la sección "por vencer" ordenado ascendentemente por días restantes.

- **Caso borde:** si no indico fecha, el ítem se lista en "sin fecha" y no genera alertas.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `pantry_items.expires_on`; índice parcial de vencimientos.
- **Pantallas / UI:** Despensa
- **Reglas, límites y notas:** 
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-152"></a>
### US-152 · Sugerir reemplazos para ajustar el plan al presupuesto

| Campo | Valor |
|---|---|
| ID | US-152 (id Jira 152) |
| Épica | E3 · Compras, presupuesto y despensa |
| Módulo | [M07 · Presupuesto y precios](../04-modulos/M07.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #52 de 73) |
| Tipo | historia |
| Etiquetas | presupuesto |
| Ref. backlog | HU-52 · Subárea: Presupuesto |
| Dependencias | US-132 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario que excede su presupuesto
- **quiero** recibir sugerencias automáticas de reemplazo (ej. proteína más económica)
- **para** ajustarme sin rehacer todo el plan.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que mi plan excede el presupuesto en $8.000
   - Cuando toco "Ajustar automáticamente"
   - Entonces el sistema propone al menos 2 sustituciones concretas con el ahorro exacto (ej. "cambiar salmón por atún enlatado: ahorras $6.500") y recalcula el nuevo total en tiempo real al aceptar cada una.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** Reemplazos por receta más barata: `eligible_recipes` ordenadas por `recipe_cost`.
- **Pantallas / UI:** Plan (sugerencias de ahorro)
- **Reglas, límites y notas:** Sugerir, no aplicar sin confirmación.
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-153"></a>
### US-153 · Notificar ingredientes por vencer con recetas sugeridas

| Campo | Valor |
|---|---|
| ID | US-153 (id Jira 153) |
| Épica | E3 · Compras, presupuesto y despensa |
| Módulo | [M06 · Compras y despensa](../04-modulos/M06.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #53 de 73) |
| Tipo | historia |
| Etiquetas | desperdicio |
| Ref. backlog | HU-53 · Subárea: Desperdicio |
| Dependencias | US-142, US-148 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** recibir una notificación cuando un ingrediente esté por vencer, junto con recetas que lo usan
- **para** (no declarado en el backlog original; inferir del criterio de aceptación)

**Criterios de aceptación**

1. **Escenario 1**
   - Dado un ingrediente que vence en 2 días
   - Cuando el sistema ejecuta su revisión diaria programada
   - Entonces se envía una notificación push con al menos 1 receta real del catálogo que use ese ingrediente como principal, nunca una sugerencia genérica de "cocina algo con esto".

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `recipes_using_expiring_ingredients(dias)`; `pg_cron` + Edge Function `send-notifications`; tabla `notifications` con unicidad para idempotencia.
- **Pantallas / UI:** Notificaciones push, Despensa
- **Reglas, límites y notas:** Máximo según `notification_preferences.frequency`. Mensaje sin datos de salud en el texto de la notificación.
- **Pruebas existentes:** tests/30

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-161"></a>
### US-161 · Compartir lista de compras con otra persona

| Campo | Valor |
|---|---|
| ID | US-161 (id Jira 161) |
| Épica | E3 · Compras, presupuesto y despensa |
| Módulo | [M06 · Compras y despensa](../04-modulos/M06.md) |
| Fase | F3 Después |
| Prioridad | Low (orden en backlog: #61 de 73) |
| Tipo | historia |
| Etiquetas | compras |
| Ref. backlog | HU-61 · Subárea: Compras |
| Dependencias | US-124 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** compartir mi lista de compras con otra persona de mi hogar
- **para** dividir la compra.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que tengo una lista de compras generada
   - Cuando toco "Compartir" y la otra persona abre el enlace
   - Entonces si esa persona marca un ítem como comprado, el cambio se refleja en mi app en menos de 5 segundos.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** BRECHA: no hay hogares ni listas compartidas en el esquema. Requiere migración de membresías.
- **Pantallas / UI:** Compras (compartir)
- **Reglas, límites y notas:** Dato personal de terceros: pedir consentimiento de quien recibe. Diseñar junto a hogares.
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-162"></a>
### US-162 · Sugerir recetas de aprovechamiento de sobras

| Campo | Valor |
|---|---|
| ID | US-162 (id Jira 162) |
| Épica | E3 · Compras, presupuesto y despensa |
| Módulo | [M06 · Compras y despensa](../04-modulos/M06.md) |
| Fase | F3 Después |
| Prioridad | Low (orden en backlog: #62 de 73) |
| Tipo | historia |
| Etiquetas | desperdicio |
| Ref. backlog | HU-62 · Subárea: Desperdicio |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** que sobras de una receta (ej. medio pimiento) generen sugerencias de aprovechamiento
- **para** el día siguiente.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que marco "sobró medio pimiento" al finalizar una receta
   - Cuando se genera el plan del día siguiente
   - Entonces al menos una receta sugerida incluye pimiento entre sus ingredientes principales.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** Parcial: `recipes_using_expiring_ingredients` + generación asistida. BRECHA: no se modela «sobras».
- **Pantallas / UI:** Receta, Despensa
- **Reglas, límites y notas:** 
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-163"></a>
### US-163 · Reconocer ingredientes desde una foto

| Campo | Valor |
|---|---|
| ID | US-163 (id Jira 163) |
| Épica | E3 · Compras, presupuesto y despensa |
| Módulo | [M12 · Integraciones futuras](../04-modulos/M12.md) |
| Fase | F3 Después |
| Prioridad | Low (orden en backlog: #63 de 73) |
| Tipo | historia |
| Etiquetas | foto-y-ocr |
| Ref. backlog | HU-63 · Subárea: Foto y OCR |
| Dependencias | US-119 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** tomar una foto de mi despensa o refrigerador
- **para** que la app identifique automáticamente los ingredientes disponibles.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que tomo una foto de mi refrigerador
   - Cuando la app procesa la imagen
   - Entonces identifica correctamente al menos el 70% de los ítems presentes sobre una lista de prueba de 20 alimentos comunes, y me permite corregir o eliminar cualquier ítem mal identificado antes de guardar.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** Edge Function con proveedor de visión + Storage; BRECHA: mapeo producto → ingrediente.
- **Pantallas / UI:** Despensa (foto)
- **Reglas, límites y notas:** Las fotos son datos personales: Storage por usuario, borrado tras procesar.
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-164"></a>
### US-164 · Escanear recibo de compra con OCR

| Campo | Valor |
|---|---|
| ID | US-164 (id Jira 164) |
| Épica | E3 · Compras, presupuesto y despensa |
| Módulo | [M12 · Integraciones futuras](../04-modulos/M12.md) |
| Fase | F3 Después |
| Prioridad | Low (orden en backlog: #64 de 73) |
| Tipo | historia |
| Etiquetas | foto-y-ocr |
| Ref. backlog | HU-64 · Subárea: Foto y OCR |
| Dependencias | US-119, US-141 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** escanear el recibo de mi compra
- **para** actualizar mi despensa y mi gasto real automáticamente.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que subo la foto de un recibo de supermercado estándar
   - Cuando se procesa con OCR
   - Entonces se extraen correctamente ítem, cantidad y precio del 80% de las líneas en una muestra de prueba de 20 recibos; las líneas no reconocidas quedan marcadas para revisión manual, nunca se descartan silenciosamente.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** Edge Function de OCR; resultado a `purchases` y `purchase_items`; BRECHA: presentaciones de empaque (bolsa de 500 g).
- **Pantallas / UI:** Compras (escanear recibo)
- **Reglas, límites y notas:** 
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-165"></a>
### US-165 · Mostrar precios actualizados según supermercado elegido

| Campo | Valor |
|---|---|
| ID | US-165 (id Jira 165) |
| Épica | E3 · Compras, presupuesto y despensa |
| Módulo | [M12 · Integraciones futuras](../04-modulos/M12.md) |
| Fase | F3 Después |
| Prioridad | Low (orden en backlog: #65 de 73) |
| Tipo | historia |
| Etiquetas | supermercados |
| Ref. backlog | HU-65 · Subárea: Supermercados |
| Dependencias | US-120 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** ver el precio actualizado de los ingredientes de mi lista según el supermercado que elijo
- **para** presupuestar con precisión.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que selecciono "Supermercado X" como mi tienda habitual
   - Cuando genero mi lista de compras
   - Entonces cada ítem muestra el precio obtenido vía API de esa tienda con antigüedad ≤24 horas.

- **Caso borde:** si la API falla, se usa el precio promedio histórico y se indica "precio estimado, no en tiempo real".

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `price_sources` por supermercado + `ingredient_prices`; BRECHA: precios por tienda/ubicación.
- **Pantallas / UI:** Compras
- **Reglas, límites y notas:** Requiere acuerdos y licencias con los supermercados.
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-166"></a>
### US-166 · Enviar lista de compras como pedido al supermercado

| Campo | Valor |
|---|---|
| ID | US-166 (id Jira 166) |
| Épica | E3 · Compras, presupuesto y despensa |
| Módulo | [M12 · Integraciones futuras](../04-modulos/M12.md) |
| Fase | F3 Después |
| Prioridad | Low (orden en backlog: #66 de 73) |
| Tipo | historia |
| Etiquetas | supermercados |
| Ref. backlog | HU-66 · Subárea: Supermercados |
| Dependencias | US-165, US-124 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** hacer el pedido de mi lista de compras directamente desde la app
- **para** no tener que reingresarla en otra plataforma.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que tengo una lista de compras completa y un supermercado conectado
   - Cuando toco "Pedir ahora"
   - Entonces los ítems se agregan al carrito externo vía su API y veo una pantalla de confirmación con el total antes de que se procese cualquier pago, sin cobros automáticos sin confirmación explícita.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** BRECHA: no hay pedidos. Depende de una alianza y de una API de terceros.
- **Pantallas / UI:** Compras
- **Reglas, límites y notas:** 
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---
