# E4 · Nutrición y feedback

Product Goal: Que cada usuario deje de improvisar qué cocinar y planifique su semana de comidas respetando su salud, sus gustos y su presupuesto.

Muestra información nutricional confiable por receta y por día, y usa las calificaciones y comentarios del usuario para mejorar las próximas recomendaciones.

10 historias · 16 subtareas.

| ID | Título | Módulo | Fase | Prio |
|---|---|---|---|---|
| [US-111](#us-111) | Calcular la información nutricional de cada receta a partir de sus ingredientes | M03 | F1 | High |
| [US-114](#us-114) | Informar que la app no reemplaza el consejo médico o nutricional | M01 | F0 | High |
| [US-115](#us-115) | Mostrar calorías y macros por porción en cada receta | M08 | F1 | High |
| [US-121](#us-121) | Revisar con un nutricionista titulado las recetas y reglas nutricionales | M03 | F1 | High |
| [US-128](#us-128) | Calificar una receta después de cocinarla | M08 | F1 | High |
| [US-134](#us-134) | Usar calificaciones para ajustar futuras recomendaciones | M08 | F1 | High |
| [US-143](#us-143) | Mostrar micronutrientes clave (sodio, azúcar, fibra) | M08 | F2 | Medium |
| [US-144](#us-144) | Dejar comentario corto sobre una receta | M08 | F2 | Medium |
| [US-151](#us-151) | Reportar un problema o enviar sugerencias desde la app | M08 | F2 | Medium |
| [US-159](#us-159) | Resumen nutricional diario vs. objetivos | M08 | F2 | Medium |

---

<a id="us-111"></a>
### US-111 · Calcular la información nutricional de cada receta a partir de sus ingredientes

| Campo | Valor |
|---|---|
| ID | US-111 (id Jira 111) |
| Épica | E4 · Nutrición y feedback |
| Módulo | [M03 · Catálogo de recetas e ingredientes](../04-modulos/M03.md) |
| Fase | F1 MVP |
| Prioridad | High (orden en backlog: #11 de 73) |
| Tipo | historia |
| Etiquetas | nutricion, mvp, agregada-por-po |
| Ref. backlog | HU-11 · Subárea: Nutrición |
| Dependencias | US-110 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** que la información nutricional de cada receta sea confiable y se calcule a partir de sus ingredientes
- **para** tomar decisiones informadas sin dudar de los datos.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado un ingrediente del catálogo
   - Cuando se consulta su registro nutricional
   - Entonces devuelve los 7 valores por 100 g junto con su fuente.

2. **Escenario 2**
   - Dado una receta de 4 porciones
   - Cuando se calcula su información nutricional
   - Entonces el total por porción difiere en ≤5% del cálculo manual de referencia en una muestra de 10 recetas de validación.

- **Caso borde:** una receta con algún ingrediente sin dato nutricional no puede publicarse en el catálogo.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** Vista `recipe_nutrition` (por porción base) a partir de `ingredient_nutrition` (por 100 g) y `private.to_grams`.
- **Pantallas / UI:** Receta
- **Reglas, límites y notas:** Nunca se captura nutrición por receta a mano. Los ingredientes opcionales NO suman.
- **Pruebas existentes:** tests/20 (nutrición vs cálculo manual)

**Subtareas**

- [ ] (1035) Seleccionar y verificar licencia de la fuente de datos nutricionales
- [ ] (1036) Cargar los valores por 100 g de los ingredientes del catálogo
- [ ] (1037) Implementar el cálculo nutricional por porción
- [ ] (1038) Validar contra 10 recetas de referencia (tolerancia ≤5%)

**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-114"></a>
### US-114 · Informar que la app no reemplaza el consejo médico o nutricional

| Campo | Valor |
|---|---|
| ID | US-114 (id Jira 114) |
| Épica | E4 · Nutrición y feedback |
| Módulo | [M01 · Cuenta, consentimientos y privacidad](../04-modulos/M01.md) |
| Fase | F0 Fundaciones y validación |
| Prioridad | High (orden en backlog: #14 de 73) |
| Tipo | historia |
| Etiquetas | nutricion, mvp, agregada-por-po |
| Ref. backlog | HU-14 · Subárea: Nutrición |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario con una condición de salud
- **quiero** que la app me aclare que no reemplaza a un profesional
- **para** saber cuándo debo consultar a mi médico o nutricionista.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que declaro una condición médica (por ejemplo diabetes o hipertensión) en mi perfil
   - Cuando termino ese paso del onboarding
   - Entonces veo un aviso que debo aceptar antes de continuar, con el texto "Esta app es una herramienta de apoyo y no reemplaza el consejo de un profesional de la salud".

- **Caso borde:** el aviso queda disponible de forma permanente en Configuración > Acerca de y no se vuelve a mostrar en cada inicio de sesión.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `legal_documents` kind `health_disclaimer`; trigger `require_health_disclaimer` en `user_conditions`; función `accept_consent(document_id)`.
- **Pantallas / UI:** Onboarding (antes de condiciones médicas), Receta, Plan (pie fijo)
- **Reglas, límites y notas:** El aviso es informativo y se acepta con casilla. La app lo muestra además la primera vez que se genera un plan. Sin alertas médicas ni lenguaje de diagnóstico en toda la UI.
- **Pruebas existentes:** tests/10

**Subtareas**

- [ ] (1043) Diseñar UX/UI: Informar que la app no reemplaza el consejo médico o nutricional
- [ ] (1044) Implementar lógica y API: Informar que la app no reemplaza el consejo médico o nutricional
- [ ] (1045) Construir interfaz en la app: Informar que la app no reemplaza el consejo médico o nutricional
- [ ] (1046) Pruebas de aceptación: Informar que la app no reemplaza el consejo médico o nutricional

**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-115"></a>
### US-115 · Mostrar calorías y macros por porción en cada receta

| Campo | Valor |
|---|---|
| ID | US-115 (id Jira 115) |
| Épica | E4 · Nutrición y feedback |
| Módulo | [M08 · Nutrición y feedback](../04-modulos/M08.md) |
| Fase | F1 MVP |
| Prioridad | High (orden en backlog: #15 de 73) |
| Tipo | historia |
| Etiquetas | nutricion, mvp |
| Ref. backlog | HU-15 · Subárea: Nutrición |
| Dependencias | US-111 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** ver las calorías y macronutrientes de cada receta por porción
- **para** tomar decisiones informadas.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado cualquier receta del catálogo
   - Cuando abro su detalle
   - Entonces veo kcal, proteína (g), carbohidratos (g) y grasa (g) por porción, visibles sin necesidad de scroll adicional, calculados desde la base de datos nutricional (no estimados manualmente por el equipo de contenido).

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** Vista `recipe_nutrition` (kcal, proteína, carbohidratos, grasa por porción).
- **Pantallas / UI:** Receta
- **Reglas, límites y notas:** Escalar porciones no cambia el valor por porción.
- **Pruebas existentes:** tests/20

**Subtareas**

- [ ] (1047) Diseñar UX/UI: Mostrar calorías y macros por porción en cada receta
- [ ] (1048) Implementar lógica y API: Mostrar calorías y macros por porción en cada receta
- [ ] (1049) Construir interfaz en la app: Mostrar calorías y macros por porción en cada receta
- [ ] (1050) Pruebas de aceptación: Mostrar calorías y macros por porción en cada receta

**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-121"></a>
### US-121 · Revisar con un nutricionista titulado las recetas y reglas nutricionales

| Campo | Valor |
|---|---|
| ID | US-121 (id Jira 121) |
| Épica | E4 · Nutrición y feedback |
| Módulo | [M03 · Catálogo de recetas e ingredientes](../04-modulos/M03.md) |
| Fase | F1 MVP |
| Prioridad | High (orden en backlog: #21 de 73) |
| Tipo | historia |
| Etiquetas | nutricion, mvp, agregada-por-po |
| Ref. backlog | HU-21 · Subárea: Nutrición |
| Dependencias | US-110 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario con una condición de salud
- **quiero** que las recetas y las reglas nutricionales de la app hayan sido revisadas por un nutricionista titulado
- **para** confiar en lo que me recomienda.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado el catálogo inicial de recetas
   - Cuando el nutricionista termina la revisión
   - Entonces el 100% de las recetas tiene registrados el nombre del revisor y la fecha de revisión, y las recetas rechazadas no se publican.

- **Caso borde:** las reglas de sustitución (por ejemplo leche por leche de almendra) y los umbrales de sodio y calorías que usa la app quedan aprobados por escrito antes de usarse en producción.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `nutritionist_reviews` + rol `nutritionist` en `user_roles`; trigger `enforce_recipe_publishable` exige una revisión aprobada para recetas oficiales.
- **Pantallas / UI:** Back-office de revisión (Supabase Studio en el MVP)
- **Reglas, límites y notas:** No hay panel propio en el MVP; se opera desde Supabase Studio con el rol de servicio. La revisión es externa: la historia se cumple cuando existe el procedimiento y el registro.
- **Pruebas existentes:** tests/20

**Subtareas**

- [ ] (1071) Coordinar al nutricionista revisor y acordar el alcance
- [ ] (1072) Definir el formato de revisión y de registro del revisor
- [ ] (1073) Revisar las recetas del catálogo inicial
- [ ] (1074) Aprobar por escrito las reglas de sustitución y los umbrales

**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-128"></a>
### US-128 · Calificar una receta después de cocinarla

| Campo | Valor |
|---|---|
| ID | US-128 (id Jira 128) |
| Épica | E4 · Nutrición y feedback |
| Módulo | [M08 · Nutrición y feedback](../04-modulos/M08.md) |
| Fase | F1 MVP |
| Prioridad | High (orden en backlog: #28 de 73) |
| Tipo | historia |
| Etiquetas | feedback, mvp |
| Ref. backlog | HU-28 · Subárea: Feedback |
| Dependencias | US-123 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** calificar una receta después de cocinarla
- **para** mejorar mis futuras recomendaciones.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que marco una receta como "cocinada"
   - Cuando confirmo esa acción
   - Entonces se despliega un selector de 1 a 5 estrellas obligatorio antes de cerrar el modal, y la calificación queda asociada a receta+usuario+fecha en el historial.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `recipe_ratings` (1-5) + `recipe_rating_tag_links` → `rating_tags`; trigger `validate_rating` (la comida debe ser del usuario y de esa receta).
- **Pantallas / UI:** Receta (calificar tras cocinar)
- **Reglas, límites y notas:** Cada vez que se cocina y califica queda una fila (historial).
- **Pruebas existentes:** tests/50 (calificaciones)

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-134"></a>
### US-134 · Usar calificaciones para ajustar futuras recomendaciones

| Campo | Valor |
|---|---|
| ID | US-134 (id Jira 134) |
| Épica | E4 · Nutrición y feedback |
| Módulo | [M08 · Nutrición y feedback](../04-modulos/M08.md) |
| Fase | F1 MVP |
| Prioridad | High (orden en backlog: #34 de 73) |
| Tipo | historia |
| Etiquetas | feedback, mvp |
| Ref. backlog | HU-34 · Subárea: Feedback |
| Dependencias | US-128 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** que mis calificaciones afecten las próximas recomendaciones
- **para** no volver a ver recetas que no me gustaron.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que califiqué "Sopa de lentejas" con 1 estrella
   - Cuando se genera mi próximo plan semanal
   - Entonces esa receta específica no vuelve a aparecer durante al menos 60 días, y recetas con ingredientes principales similares bajan su prioridad en el ranking un 20%.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `eligible_recipes` excluye recetas con 1-2 estrellas de los últimos 60 días; el ranking de `generate-plan` usa el historial.
- **Pantallas / UI:** —
- **Reglas, límites y notas:** 
- **Pruebas existentes:** tests/30 (ventana de 60 días)

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-143"></a>
### US-143 · Mostrar micronutrientes clave (sodio, azúcar, fibra)

| Campo | Valor |
|---|---|
| ID | US-143 (id Jira 143) |
| Épica | E4 · Nutrición y feedback |
| Módulo | [M08 · Nutrición y feedback](../04-modulos/M08.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #43 de 73) |
| Tipo | historia |
| Etiquetas | nutricion |
| Ref. backlog | HU-43 · Subárea: Nutrición |
| Dependencias | US-111 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario con una condición médica
- **quiero** ver sodio, azúcar y fibra por receta
- **para** cuidar mi condición.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que declaré hipertensión en mi perfil
   - Cuando abro el detalle nutricional expandido de una receta
   - Entonces veo el contenido de sodio en mg junto con una referencia visual si supera el 30% de la ingesta diaria recomendada.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** Misma vista: fibra, azúcar y sodio por porción.
- **Pantallas / UI:** Receta
- **Reglas, límites y notas:** 
- **Pruebas existentes:** tests/20

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-144"></a>
### US-144 · Dejar comentario corto sobre una receta

| Campo | Valor |
|---|---|
| ID | US-144 (id Jira 144) |
| Épica | E4 · Nutrición y feedback |
| Módulo | [M08 · Nutrición y feedback](../04-modulos/M08.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #44 de 73) |
| Tipo | historia |
| Etiquetas | feedback |
| Ref. backlog | HU-44 · Subárea: Feedback |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** dejar un comentario corto sobre una receta (ej. 'muy salado')
- **para** dar contexto además de la calificación numérica.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que califiqué una receta con 2 estrellas
   - Cuando se me pregunta "¿qué pasó?"
   - Entonces puedo elegir una etiqueta rápida ("muy salado", "tardó más de lo esperado", "no me gustó el sabor") o escribir texto libre de hasta 200 caracteres; el campo es opcional y puedo omitirlo con un toque.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `recipe_ratings.comment` (≤200 caracteres). No confundir con `recipe_comments` (comunidad).
- **Pantallas / UI:** Receta (calificar)
- **Reglas, límites y notas:** 
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-151"></a>
### US-151 · Reportar un problema o enviar sugerencias desde la app

| Campo | Valor |
|---|---|
| ID | US-151 (id Jira 151) |
| Épica | E4 · Nutrición y feedback |
| Módulo | [M08 · Nutrición y feedback](../04-modulos/M08.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #51 de 73) |
| Tipo | historia |
| Etiquetas | feedback, agregada-por-po |
| Ref. backlog | HU-51 · Subárea: Feedback |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** reportar un problema o enviar una sugerencia desde la app
- **para** que el equipo mejore el producto.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que estoy en cualquier pantalla
   - Cuando abro Configuración > Ayuda y envío un mensaje de hasta 500 caracteres con una captura opcional
   - Entonces recibo una confirmación y el equipo lo recibe con la versión de la app y el modelo del dispositivo.

- **Caso borde:** el envío no incluye datos de salud ni de perfil, salvo que yo los escriba en el mensaje.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `support_tickets` (inmutable para el usuario) + Storage para capturas.
- **Pantallas / UI:** Perfil > Ayuda
- **Reglas, límites y notas:** Capturas con políticas por usuario; sin datos de salud en los logs adjuntos.
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-159"></a>
### US-159 · Resumen nutricional diario vs. objetivos

| Campo | Valor |
|---|---|
| ID | US-159 (id Jira 159) |
| Épica | E4 · Nutrición y feedback |
| Módulo | [M08 · Nutrición y feedback](../04-modulos/M08.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #59 de 73) |
| Tipo | historia |
| Etiquetas | nutricion |
| Ref. backlog | HU-59 · Subárea: Nutrición |
| Dependencias | US-123, US-115 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** ver un resumen nutricional diario comparado contra mis objetivos
- **para** saber si voy bien encaminado.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que marqué como cocinadas 2 de las 3 comidas de hoy
   - Cuando abro "Mi día"
   - Entonces veo el total acumulado de kcal y macros de esas 2 comidas comparado contra mi objetivo diario, con la comida faltante mostrada como "pendiente" y no contabilizada como 0.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** BRECHA MENOR: crear RPC `daily_nutrition(date)` que sume `recipe_nutrition × servings` de las comidas cocinadas o planeadas del día. Objetivo: `profiles.daily_kcal_target`, `target_protein_pct`.
- **Pantallas / UI:** Plan (resumen del día)
- **Reglas, límites y notas:** Es un indicador informativo; sin lenguaje de recomendación médica.
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---
