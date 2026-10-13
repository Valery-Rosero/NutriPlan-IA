# E6 · Fundamentos, calidad y lanzamiento

Product Goal: Que cada usuario deje de improvisar qué cocinar y planifique su semana de comidas respetando su salud, sus gustos y su presupuesto.

Habilita construir, medir, asegurar la calidad y lanzar el producto: despliegue automático, monitoreo, analítica, accesibilidad, rendimiento, validación con usuarios y publicación en tiendas.

7 historias · 8 subtareas.

| ID | Título | Módulo | Fase | Prio |
|---|---|---|---|---|
| [US-101](#us-101) | Validar el prototipo con usuarios reales antes de construir | M11 | F0 | High |
| [US-102](#us-102) | Desplegar versiones nuevas de forma automática y segura | M11 | F0 | High |
| [US-122](#us-122) | Detectar y corregir fallas de la app rápidamente | M11 | F2 | Medium |
| [US-131](#us-131) | Medir el uso de las funciones clave para priorizar con datos | M11 | F2 | Medium |
| [US-140](#us-140) | Usar la app con baja visión o lector de pantalla | M11 | F2 | Medium |
| [US-150](#us-150) | Abrir y navegar la app con rapidez | M11 | F2 | Medium |
| [US-158](#us-158) | Descargar la app desde la tienda oficial de mi teléfono | M11 | F1 | High |

---

<a id="us-101"></a>
### US-101 · Validar el prototipo con usuarios reales antes de construir

| Campo | Valor |
|---|---|
| ID | US-101 (id Jira 101) |
| Épica | E6 · Fundamentos, calidad y lanzamiento |
| Módulo | [M11 · Plataforma, calidad y lanzamiento](../04-modulos/M11.md) |
| Fase | F0 Fundaciones y validación |
| Prioridad | High (orden en backlog: #1 de 73) |
| Tipo | enabler |
| Etiquetas | calidad, mvp, agregada-por-po |
| Ref. backlog | HU-01 · Subárea: Calidad |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** Product Owner
- **quiero** validar el prototipo del onboarding, el plan semanal y la lista de compras con usuarios reales
- **para** construir lo que de verdad necesitan y no lo que suponemos.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado el prototipo navegable actual
   - Cuando se realizan 5 sesiones de prueba con personas que planifican sus comidas (al menos 1 con alergia alimentaria)
   - Entonces al menos 4 de 5 completan las tareas "declarar mis alergias", "cambiar una comida" y "generar la lista de compras" sin ayuda.

- **Caso borde:** cada hallazgo de usabilidad se registra como ítem del backlog, con evidencia (nota o grabación), dentro de los 3 días siguientes a la última sesión.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** Entregable de producto: informe de 5 sesiones sobre el prototipo (`referencias/prototipo/`).
- **Pantallas / UI:** Prototipo navegable
- **Reglas, límites y notas:** Al menos 1 participante con alergia alimentaria.
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-102"></a>
### US-102 · Desplegar versiones nuevas de forma automática y segura

| Campo | Valor |
|---|---|
| ID | US-102 (id Jira 102) |
| Épica | E6 · Fundamentos, calidad y lanzamiento |
| Módulo | [M11 · Plataforma, calidad y lanzamiento](../04-modulos/M11.md) |
| Fase | F0 Fundaciones y validación |
| Prioridad | High (orden en backlog: #2 de 73) |
| Tipo | enabler |
| Etiquetas | plataforma, mvp, agregada-por-po |
| Ref. backlog | HU-02 · Subárea: Plataforma |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** que las actualizaciones de la app lleguen sin caídas ni fallas
- **para** poder planificar mis comidas cuando lo necesite.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado un cambio aprobado que se integra a la rama principal
   - Cuando pasan las pruebas automáticas
   - Entonces se despliega a un entorno de pruebas (staging) en máximo 15 minutos sin intervención manual.

- **Caso borde:** si las pruebas fallan, el despliegue se detiene y se notifica al equipo; cualquier versión en producción puede revertirse a la anterior en menos de 10 minutos.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** GitHub Actions: lint, tipos, `tests/run.sh`, build de EAS; `supabase db push` a staging y luego producción.
- **Pantallas / UI:** —
- **Reglas, límites y notas:** Tres proyectos Supabase (dev, staging, producción). El seed solo en dev.
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**

- [ ] (1001) Configurar entornos de pruebas y producción
- [ ] (1002) Crear el pipeline de integración continua con pruebas automáticas
- [ ] (1003) Automatizar el despliegue a staging
- [ ] (1004) Documentar y probar el procedimiento de reversión

**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-122"></a>
### US-122 · Detectar y corregir fallas de la app rápidamente

| Campo | Valor |
|---|---|
| ID | US-122 (id Jira 122) |
| Épica | E6 · Fundamentos, calidad y lanzamiento |
| Módulo | [M11 · Plataforma, calidad y lanzamiento](../04-modulos/M11.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #22 de 73) |
| Tipo | enabler |
| Etiquetas | plataforma, agregada-por-po |
| Ref. backlog | HU-22 · Subárea: Plataforma |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** que las fallas de la app se detecten y se corrijan rápido
- **para** que no me impidan planificar mis comidas.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que ocurre un error no controlado en la app o en el servidor
   - Cuando se registra
   - Entonces el equipo recibe una alerta en máximo 5 minutos con el detalle técnico y sin incluir datos de salud del usuario.

- **Caso borde:** existe un panel con tasa de errores y disponibilidad semanal, y se dispara una alerta cuando la disponibilidad cae por debajo del 99%.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** Sentry en app y Edge Functions con scrubbing de datos de salud.
- **Pantallas / UI:** —
- **Reglas, límites y notas:** Nunca enviar a Sentry alergias, condiciones ni medidas.
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**

- [ ] (1075) Diseñar UX/UI: Detectar y corregir fallas de la app rápidamente
- [ ] (1076) Implementar lógica y API: Detectar y corregir fallas de la app rápidamente
- [ ] (1077) Construir interfaz en la app: Detectar y corregir fallas de la app rápidamente
- [ ] (1078) Pruebas de aceptación: Detectar y corregir fallas de la app rápidamente

**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-131"></a>
### US-131 · Medir el uso de las funciones clave para priorizar con datos

| Campo | Valor |
|---|---|
| ID | US-131 (id Jira 131) |
| Épica | E6 · Fundamentos, calidad y lanzamiento |
| Módulo | [M11 · Plataforma, calidad y lanzamiento](../04-modulos/M11.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #31 de 73) |
| Tipo | enabler |
| Etiquetas | analitica, agregada-por-po |
| Ref. backlog | HU-31 · Subárea: Analítica |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** Product Owner
- **quiero** medir el uso de las funciones clave
- **para** decidir qué priorizar en el backlog con datos y no con intuición.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que un usuario completa el onboarding, genera un plan, genera una lista de compras o marca una comida como cocinada
   - Cuando ocurre cada acción
   - Entonces se registra un evento anónimo con fecha y tipo de acción.

- **Caso borde:** ningún evento incluye alergias, condiciones médicas ni datos personales identificables, y el usuario puede desactivar la analítica desde Configuración.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `analytics_events` (anónima, sin `user_id`); bloqueo por `profiles.analytics_enabled` en RLS.
- **Pantallas / UI:** Ajustes (interruptor de analítica)
- **Reglas, límites y notas:** Eventos solo del enum `analytics_event`. Identificador anónimo generado en el dispositivo.
- **Pruebas existentes:** tests/50 (opt-out)

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-140"></a>
### US-140 · Usar la app con baja visión o lector de pantalla

| Campo | Valor |
|---|---|
| ID | US-140 (id Jira 140) |
| Épica | E6 · Fundamentos, calidad y lanzamiento |
| Módulo | [M11 · Plataforma, calidad y lanzamiento](../04-modulos/M11.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #40 de 73) |
| Tipo | enabler |
| Etiquetas | calidad, agregada-por-po |
| Ref. backlog | HU-40 · Subárea: Calidad |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario con baja visión
- **quiero** que la app tenga buen contraste, texto escalable y compatibilidad con lector de pantalla
- **para** poder planificar mis comidas sin ayuda.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado cualquiera de las pantallas principales (preferencias, plan semanal, receta y lista de compras)
   - Cuando se revisa con una herramienta de contraste
   - Entonces todos los textos cumplen una relación de contraste mínima de 4.5:1.

2. **Escenario 2**
   - Dado que aumento el tamaño de fuente del sistema al 200%
   - Cuando abro esas pantallas
   - Entonces no hay texto cortado ni controles superpuestos, y todos los botones e imágenes tienen una etiqueta legible por lector de pantalla.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** —
- **Pantallas / UI:** Todas
- **Reglas, límites y notas:** Línea base desde el día uno (ver AGENTS.md): contraste, texto escalable, etiquetas de accesibilidad. La historia es la auditoría con lector de pantalla.
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-150"></a>
### US-150 · Abrir y navegar la app con rapidez

| Campo | Valor |
|---|---|
| ID | US-150 (id Jira 150) |
| Épica | E6 · Fundamentos, calidad y lanzamiento |
| Módulo | [M11 · Plataforma, calidad y lanzamiento](../04-modulos/M11.md) |
| Fase | F2 Mejora y retención |
| Prioridad | Medium (orden en backlog: #50 de 73) |
| Tipo | enabler |
| Etiquetas | calidad, agregada-por-po |
| Ref. backlog | HU-50 · Subárea: Calidad |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** que la app abra y responda rápido incluso con conexión limitada
- **para** no perder tiempo al planificar mis comidas.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado un teléfono de gama media con conexión 4G
   - Cuando abro la app
   - Entonces la pantalla principal es utilizable en máximo 3 segundos en el 95% de las mediciones.

- **Caso borde:** si la conexión falla durante la carga, se muestra un mensaje claro con la opción de reintentar, nunca una pantalla en blanco.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** Caché del plan y la lista con persistencia local (TanStack Query persist).
- **Pantallas / UI:** Todas
- **Reglas, límites y notas:** Presupuestos de rendimiento en los criterios; medir en gama media.
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-158"></a>
### US-158 · Descargar la app desde la tienda oficial de mi teléfono

| Campo | Valor |
|---|---|
| ID | US-158 (id Jira 158) |
| Épica | E6 · Fundamentos, calidad y lanzamiento |
| Módulo | [M11 · Plataforma, calidad y lanzamiento](../04-modulos/M11.md) |
| Fase | F1 MVP |
| Prioridad | High (orden en backlog: #58 de 73) |
| Tipo | enabler |
| Etiquetas | lanzamiento, mvp, agregada-por-po |
| Ref. backlog | HU-58 · Subárea: Lanzamiento |
| Dependencias | US-113, US-102 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** descargar NutriPlan AI desde la tienda oficial de mi teléfono
- **para** instalarla de forma segura y recibir actualizaciones.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado la versión 1.0 aprobada en la Sprint Review
   - Cuando se envía a Google Play y App Store
   - Entonces la ficha cumple los requisitos de cada tienda (descripción, capturas, clasificación de contenido y URL de la política de privacidad) y la versión queda aprobada y publicada.

- **Caso borde:** si una tienda rechaza la versión, el motivo se registra como ítem del backlog con prioridad alta y se corrige antes de reenviar.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** EAS Build + EAS Submit (App Store y Google Play).
- **Pantallas / UI:** —
- **Reglas, límites y notas:** Marcar la app como 18+. Política de privacidad y términos enlazados en la ficha de la tienda.
- **Pruebas existentes:** ninguna aún; escribir las del DoD

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---
