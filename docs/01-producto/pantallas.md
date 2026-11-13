# Pantallas y navegación

Referencia visual original: `referencias/app-nutricion-ia-prototipo.html` (clicable) y `referencias/app-nutricion-ia-diseno.html`. El flujo actual está centrado en la cocina (ADR-024) y el estilo en `02-arquitectura/sistema-de-diseno.md`. Las rutas viven en `app/src/app/` (Expo Router).

## Navegación
- **Acceso `(auth)`:** Bienvenida (`welcome`) · Registro (`sign-up`) · Inicio de sesión (`sign-in`) · Verificar correo (`verify-email`) · Recuperar contraseña (`forgot-password`). Fuera del grupo: `auth-callback` (enlace del correo) y `reset-password`.
- **Puertas** (`_layout.tsx`, `core/startup/gates.ts`): sin sesión → acceso; documentos pendientes → `consents` (incluye el aviso de salud); perfil incompleto → `onboarding`; si no hay conexión al abrir, entra con la caché (US-150).
- **Onboarding** (`onboarding`): Hogar (región y personas) → Autorización de datos sensibles → Alergias y dieta → Presupuesto → Preferencias (tiempo, cocinas y metas; las metas solo con la autorización) → Notificaciones (el permiso se pide al tocar "Activar avisos"; "Ahora no" salta el paso) → ¿Qué hay en tu cocina? (omitible: US-130).
- **Pestañas (ADR-024):** **Hoy** · **Mi cocina** · **Mi semana**. Perfil desde el ícono superior.
- **Pilas y modales:** Receta (`recipe/[id]`), Cambiar comida (`plan/swap/[mealId]`, modal), Agregar a la despensa (`pantry/add`, modal), Asistente (`assistant`), Perfil (`profile/index`) y sus secciones (`profile/[section]`), Ayuda y reportes (`help`), Textos legales (`legal/[kind]`), Eliminar cuenta (`account/delete`). `design-system` solo en desarrollo.

## Pantallas
| Pantalla | Propósito | Datos/RPC clave | Historias |
|---|---|---|---|
| Hoy | ¿Qué cocino ahora? Sugerencias con lo que hay, comidas del plan de hoy, "Mi día" (calorías y proteína), aviso de tiempo máximo, entrada al asistente | `cook_with_what_i_have`, `daily_nutrition`, `planned_meals` | US-119, US-159, US-136, US-139 |
| Mi cocina › Despensa | Lo que tengo, vencimientos, agregar rápido. Lo que no está en el catálogo se agrega como **alimento propio** (etiqueta "Propio", con su unidad; no entra en recetas; B3b) | `pantry_items`, `add_to_pantry` (lo que vence pronto también pesa en `cook_with_what_i_have` y en los avisos) | US-123, US-130 |
| Mi cocina › Lista de mercado | Lista agrupada, casillas sin conexión, sustitutos, registrar lo pagado, pasar a la despensa | `generate_shopping_list`, `my_shopping_items`, `substitute_shopping_item`, `record_purchase`, `move_checked_to_pantry` | US-124–126, US-147, US-141 |
| Mi semana | Calendario arriba (tira de 7 días o cuadrícula del mes si el plan es más largo; punto por día: pendiente, a medias, hecho) y, debajo, **un día por página** que se pasa deslizando como un libro (botones día anterior/siguiente; sin giro con "reducir movimiento"). Se planea por **Hoy · Semana · Mes** (B2). La página de cada día muestra también los **Adicionales** (lo cocinado fuera del plan, ADR-028). Cambiar comidas, presupuesto, gasto del mes y reemplazos para ahorrar | `generate_plan`, `plan_budget_status`, `monthly_spend`, `plan_savings` | US-117, US-120, US-127, US-129, US-132, US-141, US-152 |
| Receta | Ingredientes escalados con opciones intercambiables divididas en **En tu cocina** y **Para comprar** (lo elegido se quita con ✕; con un grupo obligatorio vacío no se puede cocinar), pasos, nutrición, costo, cocinar, calificar. "Cocinar ahora" fuera del plan suma un **plato adicional** (ADR-028) | `preview_recipe`, `recipe_flex_menu`, `cook_planned_meal`, `cook_now`, `rate_meal` | US-115, US-118, US-128, US-156 |
| Cambiar comida | Alternativas seguras para un momento del plan | `eligible_recipes`, `planned_meals` | US-129 |
| Asistente | Chat que propone una receta de la lista segura y explica por qué | `assistant-chat`, `apply_assistant_suggestion` | US-157, US-160, US-173 |
| Perfil | Resumen de la cocina; cada fila edita una parte: hogar, restricciones, presupuesto, preferencias (tiempo, cocinas, metas), notificaciones, privacidad, apariencia | `profiles`, `set_my_restrictions`, `set_my_cuisines`, `notification_preferences`, `register_push_device` | US-116, US-136–139, US-148, US-149, US-153, US-131 |
| Ayuda | Reportar un problema o sugerencia, con captura opcional | `support_tickets`, bucket `support-screenshots` | US-151 |
| Privacidad y cuenta | Consentimientos, exportar datos, eliminar cuenta | `accept_consent`, `revoke_consent`, `export_my_data`, `delete-account` | US-113, US-114, US-133 |

## Estados obligatorios en cada pantalla
Carga (esqueleto), vacío (con acción), error (reintentar), sin conexión (banner + caché; la carga ofrece reintentar) y, donde aplique, bloqueado por consentimiento (botón para aceptar). Si algo se rompe al dibujar, `ErrorBoundary` muestra `CrashState` y registra la falla.

## Accesibilidad
Etiquetas, orden de foco, contraste AA, objetivo táctil ≥44pt, texto hasta 200 %, sin información solo por color, mensajes de error asociados al campo (US-140; prueba estática en `app/src/test/a11y-static.test.ts`).
