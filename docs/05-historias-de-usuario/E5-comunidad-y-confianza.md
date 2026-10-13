# E5 · Comunidad y confianza

Product Goal: Que cada usuario deje de improvisar qué cocinar y planifique su semana de comidas respetando su salud, sus gustos y su presupuesto.

Habilita el intercambio social de recetas y comentarios entre usuarios, y protege los datos sensibles con cifrado, consentimiento y moderación de contenido.

7 historias · 9 subtareas.

| ID | Título | Módulo | Fase | Prio |
|---|---|---|---|---|
| [US-105](#us-105) | Cifrar datos de salud sensibles (reposo y tránsito) | M01 | F0 | High |
| [US-113](#us-113) | Aceptar la política de privacidad y tratamiento de datos al registrarme | M01 | F0 | High |
| [US-133](#us-133) | Exportar o eliminar todos mis datos | M01 | F1 | High |
| [US-154](#us-154) | Solicitar consentimiento explícito para funciones de comunidad | M10 | F3 | Medium |
| [US-167](#us-167) | Publicar receta propia o adaptación | M10 | F3 | Low |
| [US-168](#us-168) | Comentar y dejar tips en recetas de la comunidad | M10 | F3 | Low |
| [US-169](#us-169) | Moderar contenido publicado por usuarios | M10 | F3 | Low |

---

<a id="us-105"></a>
### US-105 · Cifrar datos de salud sensibles (reposo y tránsito)

| Campo | Valor |
|---|---|
| ID | US-105 (id Jira 105) |
| Épica | E5 · Comunidad y confianza |
| Módulo | [M01 · Cuenta, consentimientos y privacidad](../04-modulos/M01.md) |
| Fase | F0 Fundaciones y validación |
| Prioridad | High (orden en backlog: #5 de 73) |
| Tipo | historia |
| Etiquetas | privacidad, mvp |
| Ref. backlog | HU-05 · Subárea: Privacidad |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** que mis datos de salud (alergias, peso, condiciones médicas) estén cifrados
- **para** proteger mi información sensible.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que guardo una condición médica en mi perfil
   - Cuando el dato se transmite del cliente al servidor y se almacena
   - Entonces la transmisión usa TLS 1.2 o superior y el campo se almacena cifrado en la base de datos, verificable en una auditoría de seguridad; ningún log de la aplicación muestra el valor en texto plano.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** No requiere código nuevo: TLS en tránsito y cifrado en reposo de Supabase, RLS en las 59 tablas y separación de `profile_health`. Decisión ADR-008: sin cifrado por campo en el MVP.
- **Pantallas / UI:** —
- **Reglas, límites y notas:** El criterio original pide cifrado de datos de salud; se cumple con cifrado en tránsito y en reposo de la plataforma. Si el abogado o un auditor exigen cifrado por campo, ver ADR-008 (alternativa: cifrar en Edge Function). Entregable de la historia: verificación documentada (conexiones solo TLS, RLS probado, backups cifrados).
- **Pruebas existentes:** tests/10 (RLS en todas las tablas)

**Subtareas**

- [ ] (1010) Definir qué campos son datos sensibles y el esquema de cifrado en reposo
- [ ] (1011) Configurar TLS 1.2 o superior en todos los servicios
- [ ] (1012) Implementar cifrado de campos sensibles en la base de datos
- [ ] (1013) Revisar los logs para confirmar que no exponen datos sensibles
- [ ] (1014) Prueba de seguridad de la configuración

**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-113"></a>
### US-113 · Aceptar la política de privacidad y tratamiento de datos al registrarme

| Campo | Valor |
|---|---|
| ID | US-113 (id Jira 113) |
| Épica | E5 · Comunidad y confianza |
| Módulo | [M01 · Cuenta, consentimientos y privacidad](../04-modulos/M01.md) |
| Fase | F0 Fundaciones y validación |
| Prioridad | High (orden en backlog: #13 de 73) |
| Tipo | historia |
| Etiquetas | privacidad, mvp, agregada-por-po |
| Ref. backlog | HU-13 · Subárea: Privacidad |
| Dependencias | US-104 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** conocer y aceptar de forma explícita cómo se tratan mis datos personales y de salud al crear mi cuenta
- **para** decidir con información si los comparto.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que estoy creando mi cuenta
   - Cuando llego al paso de registro
   - Entonces veo un enlace a la política de privacidad y una casilla de aceptación sin premarcar; el botón "Crear cuenta" permanece deshabilitado hasta marcarla.

- **Caso borde:** el sistema guarda la versión de la política aceptada y la fecha y hora de aceptación; si la política cambia, se pide aceptar de nuevo en el siguiente inicio de sesión. La redacción debe validarse con asesoría legal conforme a la Ley 1581 de 2012 de protección de datos personales en Colombia.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** Mismo `signUp`; versión vigente = `private.latest_legal_document('privacy_policy')`. Evidencia: `user_consents(accepted_at)` + `legal_documents.content_sha256`.
- **Pantallas / UI:** Registro (casillas: mayor de 18, términos, política)
- **Reglas, límites y notas:** Las casillas NO vienen premarcadas. La app debe leer el id del documento vigente desde `legal_documents` (lectura anónima permitida) y enviarlo. Textos en `06-legal-y-cumplimiento/borradores/`; no publicar hasta que `private.legal_readiness()` muestre todo en verdadero.
- **Pruebas existentes:** tests/10 y tests/60

**Subtareas**

- [ ] (1039) Diseñar UX/UI: Aceptar la política de privacidad y tratamiento de datos al registrarme
- [ ] (1040) Implementar lógica y API: Aceptar la política de privacidad y tratamiento de datos al registrarme
- [ ] (1041) Construir interfaz en la app: Aceptar la política de privacidad y tratamiento de datos al registrarme
- [ ] (1042) Pruebas de aceptación: Aceptar la política de privacidad y tratamiento de datos al registrarme

**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-133"></a>
### US-133 · Exportar o eliminar todos mis datos

| Campo | Valor |
|---|---|
| ID | US-133 (id Jira 133) |
| Épica | E5 · Comunidad y confianza |
| Módulo | [M01 · Cuenta, consentimientos y privacidad](../04-modulos/M01.md) |
| Fase | F1 MVP |
| Prioridad | High (orden en backlog: #33 de 73) |
| Tipo | historia |
| Etiquetas | privacidad, mvp |
| Ref. backlog | HU-33 · Subárea: Privacidad |
| Dependencias | US-104 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** poder exportar o eliminar todos mis datos de la app
- **para** tener control sobre mi información.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que estoy en configuración de privacidad
   - Cuando toco "Eliminar mi cuenta y datos" y confirmo reingresando mi contraseña
   - Entonces todos mis datos personales se eliminan o anonimizan en un plazo máximo de 30 días, con confirmación enviada por correo.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** RPC `export_my_data()` (JSON completo del usuario); `revoke_consent('sensitive_data_authorization')`; Edge Function `delete-account` que llama `auth.admin.deleteUser` (la FK en cascada borra todo). Ver `02-arquitectura/edge-functions.md`.
- **Pantallas / UI:** Perfil > Privacidad
- **Reglas, límites y notas:** `auth.users` solo se borra con service role: nunca desde el cliente. Eliminar cuenta exige confirmación reforzada (escribir la contraseña o `ELIMINAR`). Las recetas publicadas por el usuario se anonimizan (`author_id` pasa a nulo), no se pierden.
- **Pruebas existentes:** tests/50 (exportación aislada y borrado en cascada)

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-154"></a>
### US-154 · Solicitar consentimiento explícito para funciones de comunidad

| Campo | Valor |
|---|---|
| ID | US-154 (id Jira 154) |
| Épica | E5 · Comunidad y confianza |
| Módulo | [M10 · Comunidad y moderación](../04-modulos/M10.md) |
| Fase | F3 Después |
| Prioridad | Medium (orden en backlog: #54 de 73) |
| Tipo | historia |
| Etiquetas | privacidad |
| Ref. backlog | HU-54 · Subárea: Privacidad |
| Dependencias | — |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** dar consentimiento explícito antes de que mis datos se usen
- **para** funciones de comunidad, para decidir qué comparto.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que nunca he usado funciones de comunidad
   - Cuando intento publicar una receta o comentario por primera vez
   - Entonces se muestra un modal de consentimiento explícito explicando qué se hará público; sin aceptar, la acción de publicar queda bloqueada.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `accept_consent(doc community_sharing)`; trigger `require_community_consent`; `revoke_consent('community_sharing')` borra comentarios y despublica recetas propias; vista `my_pending_consents`.
- **Pantallas / UI:** Diálogo de consentimiento comunitario (primer uso de comentar/compartir)
- **Reglas, límites y notas:** Aceptar es independiente de usar la app. Revocar tiene efectos destructivos: avisar antes.
- **Pruebas existentes:** tests/60

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-167"></a>
### US-167 · Publicar receta propia o adaptación

| Campo | Valor |
|---|---|
| ID | US-167 (id Jira 167) |
| Épica | E5 · Comunidad y confianza |
| Módulo | [M10 · Comunidad y moderación](../04-modulos/M10.md) |
| Fase | F3 Después |
| Prioridad | Low (orden en backlog: #67 de 73) |
| Tipo | historia |
| Etiquetas | comunidad |
| Ref. backlog | HU-67 · Subárea: Comunidad |
| Dependencias | US-104, US-154 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** publicar una receta propia o una adaptación
- **para** compartirla con otros usuarios.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que completo nombre, ingredientes y pasos de una receta propia
   - Cuando toco "Publicar"
   - Entonces la receta pasa a estado "en revisión" si contiene palabras clave sensibles (ej. términos médicos), o se publica de inmediato en el feed comunitario si no las contiene.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `recipes.author_id` no nulo; estados `draft → in_review → published | rejected`; las mismas reglas de publicación; requiere consentimiento de comunidad.
- **Pantallas / UI:** Receta (publicar)
- **Reglas, límites y notas:** Las recetas de comunidad NO pasan por revisión nutricional (se indica en la UI). Revisión de moderación sí.
- **Pruebas existentes:** tests/20 (publicación)

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-168"></a>
### US-168 · Comentar y dejar tips en recetas de la comunidad

| Campo | Valor |
|---|---|
| ID | US-168 (id Jira 168) |
| Épica | E5 · Comunidad y confianza |
| Módulo | [M10 · Comunidad y moderación](../04-modulos/M10.md) |
| Fase | F3 Después |
| Prioridad | Low (orden en backlog: #68 de 73) |
| Tipo | historia |
| Etiquetas | comunidad |
| Ref. backlog | HU-68 · Subárea: Comunidad |
| Dependencias | US-167 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** usuario
- **quiero** comentar y dejar tips en recetas de otros usuarios
- **para** enriquecer la experiencia colectiva.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado una receta publicada en el feed comunitario
   - Cuando otro usuario escribe un comentario
   - Entonces el comentario aparece ordenado cronológicamente en menos de 3 segundos, con un botón "Reportar" visible en cada comentario.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `recipe_comments` (≤1000 caracteres, `hidden_at`); trigger de consentimiento.
- **Pantallas / UI:** Receta (comentarios)
- **Reglas, límites y notas:** 
- **Pruebas existentes:** tests/50

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---

<a id="us-169"></a>
### US-169 · Moderar contenido publicado por usuarios

| Campo | Valor |
|---|---|
| ID | US-169 (id Jira 169) |
| Épica | E5 · Comunidad y confianza |
| Módulo | [M10 · Comunidad y moderación](../04-modulos/M10.md) |
| Fase | F3 Después |
| Prioridad | Low (orden en backlog: #69 de 73) |
| Tipo | historia |
| Etiquetas | comunidad |
| Ref. backlog | HU-69 · Subárea: Comunidad |
| Dependencias | US-167 |
| Estado | Pendiente |

**Historia de usuario**

- **Como** administrador de la plataforma
- **quiero** moderar el contenido publicado por usuarios
- **para** evitar spam o consejos nutricionales peligrosos.

**Criterios de aceptación**

1. **Escenario 1**
   - Dado que un comentario recibe 3 reportes de usuarios distintos
   - Cuando se alcanza ese umbral
   - Entonces el comentario se oculta automáticamente del feed público y queda en cola de revisión manual dentro de las siguientes 24 horas.

**Especificación técnica**

- **Backend (qué existe y cómo usarlo):** `content_reports` (reporte a comentario O receta, único por reportante) y ocultamiento automático con 3 reportantes distintos; rol `moderator`.
- **Pantallas / UI:** Back-office (Studio en el MVP)
- **Reglas, límites y notas:** Panel propio de moderación = trabajo futuro.
- **Pruebas existentes:** tests/50

**Subtareas**


**Definición de hecho (además del DoD global)**

- [ ] Cada escenario y caso borde tiene una prueba automática (unitaria, de integración con la BD o Maestro E2E).
- [ ] Se respetan las reglas de AGENTS.md (alergias, cantidades en servidor, sin datos de salud en logs, accesibilidad).
- [ ] Textos en es-CO; estados vacío, carga y error implementados.
- [ ] Dependencias listadas resueltas.

---
