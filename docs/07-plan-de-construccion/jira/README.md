# Backlog para Jira (Scrum)

`nutriplan-jira-scrum.csv` trae todo el trabajo del proyecto con su jerarquía, su sprint y su estado real al 12-nov-2026. Se regenera con `python docs/07-plan-de-construccion/jira/_generar_jira.py` (lee `05-historias-de-usuario/historias.json`; los sprints, estados y subtareas están en el script).

## Jerarquía
| Nivel | Tipo en Jira | Cuántos | Qué es aquí |
|---|---|---|---|
| 1 | **Epic** | 6 | Las grandes áreas del producto (E1–E6), con el Product Goal |
| 2 | **Story** | 73 | Historias de usuario US-101 a US-173 (los *spikes* y *enablers* van como Story con su etiqueta) |
| 2 | **Task** | 21 | Trabajo técnico que no es una historia: rediseño, despliegues, Firebase, documentación, producción |
| 2 | **Bug** | 7 | Errores reales que se encontraron y corrigieron |
| 3 | **Sub-task** | 239 | Los pasos de cada historia o tarea (base de datos, pantalla, pruebas…) |

Por encima de la épica, Jira Premium tiene **Initiative** (iniciativa); en este proyecto su papel lo cumple el Product Goal, escrito en cada épica.

Además de la jerarquía, el CSV llena: **Sprint** (0 a 11), **Fix Version** (`v1.0 MVP`, `v1.1 Mejora y retención`, `v2.0 Comunidad e integraciones`), **Component** (módulos M01–M12), **Labels** (sprint, fase F0–F3, tipo y tema), **Story Points** (Fibonacci) y **Priority**.

## Sprints
| Sprint | Objetivo | Estado |
|---|---|---|
| Sprint 0 | Arranque técnico: monorepo, migraciones sobre Supabase real, CI | Cerrado |
| Sprint 1 | Cuenta y consentimientos | Cerrado |
| Sprint 2 | Catálogo versátil, onboarding, perfil y despensa | Cerrado |
| Sprint 3 | Receta versátil, nutrición y cocinar ahora | Cerrado |
| Sprint 4 | Plan semanal, cambiar comidas y presupuesto | Cerrado |
| Sprint 5 | Lista de compras sin conexión | Cerrado |
| Sprint 6 | Calificaciones, derechos del titular y EAS | Cerrado |
| Sprint 7 | Rediseño y flujo centrado en la cocina | Cerrado |
| Sprint 8 | Asistente con IA, sustitutos y soporte | Cerrado |
| Sprint 9 | Precios reales, gasto, nutrición y calidad | Cerrado |
| Sprint 10 | Fallas, avisos y despliegue a staging | Cerrado |
| Sprint 11 | APK, validación y piloto | **En curso** |
| (Backlog) | F3: comunidad, hogares, foto/OCR, supermercados, batch, picante, variantes | Por hacer |

El objetivo de cada sprint no viaja en el CSV: se escribe en Jira al editar el sprint (*Sprint goal*).

## Cómo importarlo
1. Crear el proyecto en Jira con la plantilla **Scrum** y tipo **company-managed** (administrado por la empresa). Así se importan bien sprints, versiones, componentes y story points.
2. Ir a ⚙️ **Configuración → Sistema → Importación y exportación → Importación de sistemas externos → CSV**. Requiere ser administradora del sitio. Si no aparece, usar **Filtros → Buscar incidencias → ⋯ → Importar incidencias desde CSV**: también sirve, pero puede no traer los sprints.
3. Subir `nutriplan-jira-scrum.csv`, con codificación **UTF-8** y separador **coma**. Elegir el proyecto.
4. Relacionar las columnas con los campos de Jira:

   | Columna del CSV | Campo de Jira |
   |---|---|
   | Issue ID | Issue Id (o Work item ID) |
   | Parent | Parent (o Parent Id) |
   | Issue Type | Issue Type |
   | Summary | Summary |
   | Status | Status (marcar "Map field value": To Do → Por hacer, In Progress → En curso, Done → Listo) |
   | Resolution | Resolution |
   | Priority | Priority |
   | Story Points | Story Points (en team-managed: Story point estimate) |
   | Sprint | Sprint |
   | Fix Version | Fix Version/s |
   | Component | Component/s |
   | Labels (las 5) | Labels |
   | Description | Description |

5. Revisar la validación y comenzar la importación. Las versiones y componentes que no existen se crean.

**No importes dos veces:** cada importación crea los ítems de nuevo y quedarían duplicados. Si Jira no asignó los sprints, cada ítem tiene la etiqueta `sprint-N`: crea el sprint en el backlog, busca con JQL `labels = sprint-7` y mueve todos los resultados juntos (*Bulk change* o arrastrando). Conviene probar primero en un proyecto de prueba. Para empezar a planear desde cero, se puede no relacionar `Status`, `Resolution` y `Sprint`: todo quedará en el backlog por hacer.

### Si el proyecto es team-managed (administrado por el equipo)
El importador solo ofrece Resumen, Tipo de incidencia, Descripción, Etiquetas, Id de incidencia, Principal, Sprint y Story point estimate. Relaciona esos y deja sin asignar Status, Resolution, Priority, Component y Fix Version. Todo entra en "Por hacer"; para recuperar lo demás, cada ítem trae etiquetas de respaldo:

| Etiqueta | Para |
|---|---|
| `estado-hecho`, `estado-en-curso`, `estado-por-hacer` | Cambiar el estado en bloque |
| `prioridad-alta`, `prioridad-media`, `prioridad-baja` | Prioridad |
| `v1.0`, `v1.1`, `v2.0` | Versión |
| `m01` … `m12` | Módulo (componente) |
| `sprint-0` … `sprint-11` | Sprint |

Después de importar: buscar con JQL `project = <CLAVE> AND labels = estado-hecho`, seleccionar todo y usar **Cambio masivo → Transición → Listo**; lo mismo con `estado-en-curso`. Luego, en el backlog, completar los sprints 0 a 10.

Al abrir el CSV en Excel las tildes pueden verse raras; es solo Excel (el archivo está en UTF-8). Jira lo lee bien.
