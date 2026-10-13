# E1 · Perfil y personalización

Product Goal: Que cada usuario deje de improvisar qué cocinar y planifique su semana de comidas respetando su salud, sus gustos y su presupuesto.

Captura y mantiene las preferencias, restricciones y ajustes finos del usuario (dieta, alergias, presupuesto, macros, tiempo de cocina) que alimentan cada recomendación de la app.

13 historias · 25 subtareas.

| ID | Título | Módulo | Fase | Prio |
|---|---|---|---|---|
| [US-104](#us-104) | Crear cuenta e iniciar sesión | M01 | F0 | High |
| [US-106](#us-106) | Seleccionar tipo de dieta en el onboarding | M02 | F1 | High |
| [US-107](#us-107) | Declarar alergias alimentarias como restricción dura | M02 | F1 | High |
| [US-108](#us-108) | Declarar presupuesto semanal o mensual de comida | M02 | F1 | High |
| [US-109](#us-109) | Definir número de porciones habituales | M02 | F1 | High |
| [US-116](#us-116) | Editar perfil en cualquier momento | M02 | F1 | High |
| [US-130](#us-130) | Omitir onboarding y completarlo después | M02 | F2 | Medium |
| [US-136](#us-136) | Ajustar objetivo de macronutrientes (slider de proteína) | M02 | F2 | Medium |
| [US-137](#us-137) | Fijar tiempo máximo de cocina | M02 | F2 | Medium |
| [US-138](#us-138) | Seleccionar cocinas favoritas | M02 | F2 | Medium |
| [US-145](#us-145) | Activar modo «priorizar despensa» | M02 | F2 | Medium |
| [US-170](#us-170) | Activar modo batch cooking | M02 | F3 | Low |
| [US-171](#us-171) | Definir nivel de picante preferido | M02 | F3 | Low |

---

<a id="us-104"></a>
### US-104 · Crear cuenta e iniciar sesión

| Campo | Valor |
|---|---|
| ID | US-104 (id Jira 104) |
| Épica | E1 · Perfil y personalización |
| Módulo | [M01 · Cuenta, consentimientos y privacidad](../04-modulos/M01.md) |
| Fase | F0 Fundaciones y validación |
| Prioridad | High (orden en backlog: #4 de 73) |
| Tipo | historia |
| Etiquetas | perfil, mvp, agregada-por-po |
| Ref. backlog | HU-04 · Subárea: Perfil |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuaria nueva
- **quiero** crear una cuenta e iniciar sesión con correo y contraseña
- **para** conservar mi perfil y mis planes entre dispositivos.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que ingreso un correo válido y una contraseña de al menos 8 caracteres con una mayúscula y un número
   - Cuando toco "Crear cuenta"
   - Entonces se crea mi cuenta, recibo un correo de verificación y accedo al onboarding.

- **Caso borde:** si el correo ya está registrado, se muestra "Este correo ya tiene una cuenta" con enlace a "Iniciar sesión"; tras 5 intentos fallidos de inicio de sesión, la cuenta se bloquea 15 minutos.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** Supabase Auth `signUp` (correo+contraseña) con `options.data = {privacy_policy_document_id, terms_document_id, is_adult:true}`. El trigger `private.handle_new_user` crea `profiles`, `notification_preferences` y `user_consents`; rechaza con `consent_required` o `adult_required`.
- **Pantallas / UI:** Registro, Inicio de sesión, Verificación de correo
- **Reglas, límites y notas:** Reglas de contraseña (≥8, mayúscula, número) se validan en la app y en la configuración de Auth. El bloqueo de 15 min tras 5 intentos NO viene configurable por defecto en Supabase Auth: verificar sus límites de tasa; si no alcanzan, implementar contador de intentos en una Edge Function. Nunca crear el perfil desde la app: lo hace el trigger.
- **Pruebas existentes:** tests/10_signup_rls.sql (registro con y sin consentimiento, mayoría de edad)

**Subtareas**

- [ ] (1005) Diseñar las pantallas de registro e inicio de sesión
- [ ] (1006) Implementar registro con verificación por correo (API)
- [ ] (1007) Implementar bloqueo temporal tras 5 intentos fallidos
- [ ] (1008) Construir las pantallas de registro e inicio de sesión en la app
- [ ] (1009) Pruebas de aceptación de registro, verificación y bloqueo

**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-106"></a>
### US-106 · Seleccionar tipo de dieta en el onboarding

| Campo | Valor |
|---|---|
| ID | US-106 (id Jira 106) |
| Épica | E1 · Perfil y personalización |
| Módulo | [M02 · Perfil y preferencias](../04-modulos/M02.md) |
| Fase | F1 MVP |
| Prioridad | High (orden en backlog: #6 de 73) |
| Tipo | historia |
| Etiquetas | perfil, mvp |
| Ref. backlog | HU-06 · Subárea: Perfil |
| Dependencias | US-104 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuaria nueva
- **quiero** indicar mi tipo de dieta (omnívoro, vegetariano, vegano, etc.)
- **para** que la app filtre recetas compatibles desde el primer uso.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que estoy en el paso "Estilo de alimentación"
   - Cuando selecciono "Vegetariano" y confirmo
   - Entonces mi perfil guarda dieta_tipo="vegetariano" y el primer plan generado tiene 0% de recetas con carne o pescado como ingrediente principal.

- **Caso borde:** si no selecciono ninguna opción, el botón "Continuar" queda deshabilitado y se muestra "Selecciona una opción para continuar".

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `user_diets(user_id, diet_id)`; catálogo `diets` (kind `rule_based` o `curated`); compatibilidad en la vista `recipe_diets`. Requiere autorización de datos sensibles (trigger).
- **Pantallas / UI:** Onboarding paso 2, Personalización
- **Reglas, límites y notas:** Omnívoro = ausencia de filas. Una dieta es restricción DURA: `eligible_recipes` solo devuelve recetas compatibles con TODAS las dietas del usuario. Si no hay autorización de datos sensibles, la app oculta el paso o lo marca como opcional.
- **Pruebas existentes:** tests/30 (dietas vegetarianas)

**Subtareas**

- [ ] (1015) Diseñar UX/UI: Seleccionar tipo de dieta en el onboarding
- [ ] (1016) Implementar lógica y API: Seleccionar tipo de dieta en el onboarding
- [ ] (1017) Construir interfaz en la app: Seleccionar tipo de dieta en el onboarding
- [ ] (1018) Pruebas de aceptación: Seleccionar tipo de dieta en el onboarding

**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-107"></a>
### US-107 · Declarar alergias alimentarias como restricción dura

| Campo | Valor |
|---|---|
| ID | US-107 (id Jira 107) |
| Épica | E1 · Perfil y personalización |
| Módulo | [M02 · Perfil y preferencias](../04-modulos/M02.md) |
| Fase | F1 MVP |
| Prioridad | High (orden en backlog: #7 de 73) |
| Tipo | historia |
| Etiquetas | perfil, mvp |
| Ref. backlog | HU-07 · Subárea: Perfil |
| Dependencias | US-104 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuaria con alergias
- **quiero** declarar mis alergias alimentarias
- **para** que la app nunca me sugiera recetas que las contengan.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que marqué "Frutos secos" y "Mariscos" como alergias
   - Cuando se genera cualquier plan o resultado de búsqueda
   - Entonces 0 recetas devueltas contienen esos alérgenos en su lista de ingredientes, incluida cualquier sustitución sugerida.

- **Caso borde:** si una receta ya guardada en mis favoritos contiene un alérgeno recién declarado, se elimina automáticamente de favoritos y se me notifica el motivo.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `user_allergens`; triggers `planned_meals_validate` y `purge_favorites_on_new_allergen`; `private.recipe_conflicts_with_user`. Requiere autorización de datos sensibles.
- **Pantallas / UI:** Onboarding paso 2, Personalización
- **Reglas, límites y notas:** Restricción DURA y la más importante del producto: se aplica en el filtro, en el trigger del plan y en las sugerencias del asistente. Considera también ingredientes opcionales. Nunca delegar esta verificación al modelo de lenguaje ni a la app.
- **Pruebas existentes:** tests/30 y tests/40 (alergia rechazada por trigger)

**Subtareas**

- [ ] (1019) Diseñar UX/UI: Declarar alergias alimentarias como restricción dura
- [ ] (1020) Implementar lógica y API: Declarar alergias alimentarias como restricción dura
- [ ] (1021) Construir interfaz en la app: Declarar alergias alimentarias como restricción dura
- [ ] (1022) Pruebas de aceptación: Declarar alergias alimentarias como restricción dura

**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-108"></a>
### US-108 · Declarar presupuesto semanal o mensual de comida

| Campo | Valor |
|---|---|
| ID | US-108 (id Jira 108) |
| Épica | E1 · Perfil y personalización |
| Módulo | [M02 · Perfil y preferencias](../04-modulos/M02.md) |
| Fase | F1 MVP |
| Prioridad | High (orden en backlog: #8 de 73) |
| Tipo | historia |
| Etiquetas | perfil, mvp |
| Ref. backlog | HU-08 · Subárea: Perfil |
| Dependencias | US-104 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** declarar mi presupuesto semanal o mensual de comida
- **para** que los planes generados respeten ese límite.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que ingreso $60.000 como presupuesto semanal para 2 personas
   - Cuando guardo el dato
   - Entonces el valor queda reflejado como techo de gasto en la pantalla de plan semanal.

- **Caso borde:** el campo rechaza valores no numéricos o menores a $10.000 mostrando "Ingresa un monto válido", y no permite avanzar hasta corregirlo.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `profiles.budget_amount` + `budget_period` (week|month); `meal_plans.budget_limit` es una foto calculada por trigger (semana: monto×días/7; mes: monto×días/30).
- **Pantallas / UI:** Onboarding paso 3, Personalización
- **Reglas, límites y notas:** Moneda derivada de `profiles.region_id` → `regions` → `countries`; no se guarda por usuario. Monto y periodo van juntos (check).
- **Pruebas existentes:** tests/40 (presupuesto semanal)

**Subtareas**

- [ ] (1023) Diseñar UX/UI: Declarar presupuesto semanal o mensual de comida
- [ ] (1024) Implementar lógica y API: Declarar presupuesto semanal o mensual de comida
- [ ] (1025) Construir interfaz en la app: Declarar presupuesto semanal o mensual de comida
- [ ] (1026) Pruebas de aceptación: Declarar presupuesto semanal o mensual de comida

**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-109"></a>
### US-109 · Definir número de porciones habituales

| Campo | Valor |
|---|---|
| ID | US-109 (id Jira 109) |
| Épica | E1 · Perfil y personalización |
| Módulo | [M02 · Perfil y preferencias](../04-modulos/M02.md) |
| Fase | F1 MVP |
| Prioridad | High (orden en backlog: #9 de 73) |
| Tipo | historia |
| Etiquetas | perfil, mvp |
| Ref. backlog | HU-09 · Subárea: Perfil |
| Dependencias | US-104 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** indicar cuántas personas o porciones cocino habitualmente
- **para** que las cantidades vengan ajustadas desde el inicio.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que indiqué "2 personas" en el onboarding
   - Cuando se genera cualquier receta nueva
   - Entonces la porción por defecto se muestra en 2 y las cantidades de ingredientes se calculan con el factor porciones/porción_base (ej. base 4 → factor 0.5).

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `profiles.household_size` (1-12) como valor por defecto; `planned_meals.servings` por comida.
- **Pantallas / UI:** Onboarding paso 3, Plan
- **Reglas, límites y notas:** `household_size` solo cuenta personas: no hay perfiles de hijos ni de otras personas (ver 01-producto/limitaciones.md).
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**

- [ ] (1027) Diseñar UX/UI: Definir número de porciones habituales
- [ ] (1028) Implementar lógica y API: Definir número de porciones habituales
- [ ] (1029) Construir interfaz en la app: Definir número de porciones habituales
- [ ] (1030) Pruebas de aceptación: Definir número de porciones habituales

**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-116"></a>
### US-116 · Editar perfil en cualquier momento

| Campo | Valor |
|---|---|
| ID | US-116 (id Jira 116) |
| Épica | E1 · Perfil y personalización |
| Módulo | [M02 · Perfil y preferencias](../04-modulos/M02.md) |
| Fase | F1 MVP |
| Prioridad | High (orden en backlog: #16 de 73) |
| Tipo | historia |
| Etiquetas | perfil, mvp |
| Ref. backlog | HU-16 · Subárea: Perfil |
| Dependencias | US-106, US-107 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** poder editar mi perfil (dieta, alergias, presupuesto) en cualquier momento, no solo durante el registro
- **para** (no declarado en el backlog original; inferir del criterio de aceptación)

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que tengo un perfil ya creado
   - Cuando entro a "Mi perfil" y cambio mi presupuesto de $60.000 a $40.000
   - Entonces el plan de la semana en curso recalcula el gasto restante contra el nuevo monto sin necesidad de cerrar sesión.

- **Caso borde:** si el nuevo presupuesto es menor al gasto ya registrado esa semana, se muestra "Ya superaste tu nuevo presupuesto" sin bloquear el guardado del cambio.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** UPDATE sobre `profiles`, `user_*` por RLS; vista `my_plan_conflicts` marca comidas planeadas que ya no cumplen el perfil.
- **Pantallas / UI:** Perfil, Personalización
- **Reglas, límites y notas:** Los cambios aplican a planes futuros; los planes existentes que entren en conflicto se marcan, no se borran en silencio.
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**

- [ ] (1051) Diseñar UX/UI: Editar perfil en cualquier momento
- [ ] (1052) Implementar lógica y API: Editar perfil en cualquier momento
- [ ] (1053) Construir interfaz en la app: Editar perfil en cualquier momento
- [ ] (1054) Pruebas de aceptación: Editar perfil en cualquier momento

**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-130"></a>
### US-130 · Omitir onboarding y completarlo después

| Campo | Valor |
|---|---|
| ID | US-130 (id Jira 130) |
| Épica | E1 · Perfil y personalización |
| Módulo | [M02 · Perfil y preferencias](../04-modulos/M02.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #30 de 73) |
| Tipo | historia |
| Etiquetas | perfil |
| Ref. backlog | HU-30 · Subárea: Perfil |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario ocupado
- **quiero** poder saltar el onboarding completo y completarlo después
- **para** empezar a usar la app de inmediato.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que estoy en el paso 1 del onboarding
   - Cuando toco "Completar después"
   - Entonces accedo directo al plan semanal con valores por defecto (sin restricciones, presupuesto no definido, 2 porciones) y veo un banner persistente "Completa tu perfil para mejores recomendaciones" hasta que lo complete o lo descarte 3 veces.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `profiles.onboarding_completed_at` nulo = pendiente.
- **Pantallas / UI:** Onboarding (botón «Completar después»), banner en Inicio
- **Reglas, límites y notas:** Sin alergias declaradas la app debe advertir que no puede garantizar filtrado.
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-136"></a>
### US-136 · Ajustar objetivo de macronutrientes (slider de proteína)

| Campo | Valor |
|---|---|
| ID | US-136 (id Jira 136) |
| Épica | E1 · Perfil y personalización |
| Módulo | [M02 · Perfil y preferencias](../04-modulos/M02.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #36 de 73) |
| Tipo | historia |
| Etiquetas | personalizacion |
| Ref. backlog | HU-36 · Subárea: Personalización |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** ajustar mi objetivo de proteína, carbohidratos y grasa
- **para** que las recetas sugeridas respeten mis macros.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que muevo el slider de proteína de 30% a 40% y lo suelto
   - Cuando el sistema recalcula
   - Entonces la franja de macros se actualiza en menos de 300ms (carbohidratos y grasa se ajustan para sumar 100%) y las recetas sugeridas desde ese momento aportan un mínimo de 35% de calorías provenientes de proteína.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `profiles.target_protein_pct` (10-50); carbohidratos y grasa se derivan, no se guardan.
- **Pantallas / UI:** Personalización
- **Reglas, límites y notas:** Slider solo de proteína; el resto se calcula.
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-137"></a>
### US-137 · Fijar tiempo máximo de cocina

| Campo | Valor |
|---|---|
| ID | US-137 (id Jira 137) |
| Épica | E1 · Perfil y personalización |
| Módulo | [M02 · Perfil y preferencias](../04-modulos/M02.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #37 de 73) |
| Tipo | historia |
| Etiquetas | personalizacion |
| Ref. backlog | HU-37 · Subárea: Personalización |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario con poco tiempo
- **quiero** fijar un tiempo máximo de cocción
- **para** que solo se me sugieran recetas que respeten ese límite.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que fijo 20 minutos como tiempo máximo
   - Cuando se genera el plan semanal o busco una receta
   - Entonces ninguna receta con tiempo_preparación > 20 minutos aparece en los resultados.

- **Caso borde:** si no existe ninguna receta compatible con el resto de mis restricciones, se muestra "No encontramos recetas de 20 min o menos con tus restricciones actuales, ¿probamos con 30?" en vez de una lista vacía.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `profiles.max_cook_minutes` (5-240) → filtro en `eligible_recipes` (`recipes.total_minutes` es columna generada).
- **Pantallas / UI:** Personalización
- **Reglas, límites y notas:** 
- **Pruebas existentes:** tests/30 (filtro de minutos)

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-138"></a>
### US-138 · Seleccionar cocinas favoritas

| Campo | Valor |
|---|---|
| ID | US-138 (id Jira 138) |
| Épica | E1 · Perfil y personalización |
| Módulo | [M02 · Perfil y preferencias](../04-modulos/M02.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #38 de 73) |
| Tipo | historia |
| Etiquetas | personalizacion |
| Ref. backlog | HU-38 · Subárea: Personalización |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** seleccionar mis cocinas favoritas (mediterránea, asiática, mexicana, etc.)
- **para** recibir más variedad dentro de mi gusto.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que selecciono "Mediterránea" y "Asiática" como cocinas favoritas
   - Cuando se genera el plan semanal
   - Entonces al menos el 60% de las 21 comidas del plan pertenecen a esas dos categorías, salvo que eso entre en conflicto con la regla de no repetir proteína (épica Motor de planes).

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `user_cuisines`; razón `cuisine_favorite` en `recommendation_reasons`.
- **Pantallas / UI:** Personalización
- **Reglas, límites y notas:** Preferencia blanda: sube el ranking, no excluye.
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-145"></a>
### US-145 · Activar modo «priorizar despensa»

| Campo | Valor |
|---|---|
| ID | US-145 (id Jira 145) |
| Épica | E1 · Perfil y personalización |
| Módulo | [M02 · Perfil y preferencias](../04-modulos/M02.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #45 de 73) |
| Tipo | historia |
| Etiquetas | personalizacion |
| Ref. backlog | HU-45 · Subárea: Personalización |
| Dependencias | US-119, US-117 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** activar 'priorizar despensa'
- **para** que el sistema sugiera primero recetas que usan lo que ya tengo en casa.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que activo el interruptor "Priorizar despensa" y tengo garbanzos y espinaca en mi inventario
   - Cuando se genera el plan del día
   - Entonces las recetas que usan 2 o más ingredientes ya declarados en despensa ocupan las primeras 3 posiciones del ranking, por encima de recetas con igual calificación pero 0 ingredientes en despensa.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `profiles.prioritize_pantry`; funciones `recipe_pantry_match` y `recipes_using_expiring_ingredients`.
- **Pantallas / UI:** Personalización
- **Reglas, límites y notas:** El ranking vive en la Edge Function `generate-plan`, no en la base.
- **Pruebas existentes:** tests/30 (despensa)

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-170"></a>
### US-170 · Activar modo batch cooking

| Campo | Valor |
|---|---|
| ID | US-170 (id Jira 170) |
| Épica | E1 · Perfil y personalización |
| Módulo | [M02 · Perfil y preferencias](../04-modulos/M02.md) |
| Fase | F3 Después |
| Prioridad | Low (orden en backlog: #70 de 73) |
| Tipo | historia |
| Etiquetas | personalizacion |
| Ref. backlog | HU-70 · Subárea: Personalización |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario que cocina para varios días
- **quiero** activar el modo 'batch cooking'
- **para** recibir recetas que rindan varias porciones y se conserven bien.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que activo el modo "Batch cooking"
   - Cuando se genera una receta de almuerzo o cena
   - Entonces solo se sugieren recetas etiquetadas con rendimiento ≥4 porciones y con indicación de conservación (refrigerador o congelador) visible en el detalle.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `profiles.batch_cooking`; regla en `eligible_recipes` (almuerzo/cena solo si `base_servings>=4` y `keeps_days` definido).
- **Pantallas / UI:** Personalización
- **Reglas, límites y notas:** Apto-batch se DERIVA; no existe columna.
- **Pruebas existentes:** tests/30 (batch cooking)

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-171"></a>
### US-171 · Definir nivel de picante preferido

| Campo | Valor |
|---|---|
| ID | US-171 (id Jira 171) |
| Épica | E1 · Perfil y personalización |
| Módulo | [M02 · Perfil y preferencias](../04-modulos/M02.md) |
| Fase | F3 Después |
| Prioridad | Low (orden en backlog: #71 de 73) |
| Tipo | historia |
| Etiquetas | personalizacion |
| Ref. backlog | HU-71 · Subárea: Personalización |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** indicar mi nivel de picante preferido
- **para** que las recetas se ajusten a mi tolerancia.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que fijo el nivel de picante en "Ninguno"
   - Cuando se genera cualquier receta
   - Entonces se excluyen recetas con ingredientes marcados como picantes (ají, chile, pimienta de cayena), salvo que yo los agregue manualmente como opcional.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `profiles.spice_tolerance` (0-3); vista `recipe_max_heat` (máximo de ingredientes no opcionales).
- **Pantallas / UI:** Personalización
- **Reglas, límites y notas:** El picante opcional no excluye la receta.
- **Pruebas existentes:** tests/30 (picante)

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---
