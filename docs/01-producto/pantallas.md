# Pantallas y navegación

Referencia visual: `referencias/app-nutricion-ia-prototipo.html` (clicable) y `referencias/app-nutricion-ia-diseno.html`. Las siguientes son las pantallas del prototipo; las historias añaden más (ver columna Historias).

## Navegación (Expo Router)
- **Grupo `(auth)`:** Bienvenida · Registro · Inicio de sesión · Verificación de correo · Recuperar contraseña.
- **Onboarding:** Hogar (región y personas) → Autorización de datos sensibles → Alergias y dieta → Presupuesto → ¿Qué hay en tu cocina? (omitible: US-130). El aviso de salud se acepta antes, en la puerta de consentimientos.
- **Pestañas (ADR-024):** **Hoy** (¿qué cocino?) · **Mi cocina** (lo que tengo + lista de mercado) · **Mi semana** (plan y presupuesto). Perfil desde el ícono superior. El asistente (F2) irá dentro de Hoy.
- **Modales/pilas:** Receta (detalle), Sustituir comida, Preferencias (picante, cocinas, tiempo, macros, batch), Consentimientos y privacidad, Exportar/Eliminar datos, Comunidad (publicar/calificar/reportar), Notificaciones.

## Pantallas base (prototipo)
| Pantalla | Propósito | Datos/RPC clave | Módulos |
|---|---|---|---|
| Onboarding | Capturar dieta, alergias, presupuesto, porciones | `profiles`, `user_allergens`, `user_diets`, `accept_consent` | M01, M02 |
| Personalización | Ajustes finos (tiempo, macros, cocinas, picante, despensa, batch) | `profile_preferences*` | M02 |
| Plan semanal | Ver/cambiar comidas, costo y estado de presupuesto | `meal_plans`, `planned_meals`, `plan_budget_status`, `generate-plan` | M04, M07 |
| Asistente | Chat que propone cambios y explica | `assistant-chat`, `apply_assistant_suggestion` | M05 |
| Receta | Ingredientes escalados, pasos, nutrición, "Cocinar" | `scale_recipe`, `recipe_cost`, `mark_meal_cooked` | M03, M08 |
| Compras | Lista agrupada por sección, casillas, total estimado | `generate_shopping_list`, `shopping_list_items` | M06, M07 |
| Despensa | Inventario, vencimientos, "cocinar con lo que tengo" | `add_to_pantry`, `recipes_using_expiring_ingredients`, `recipe_pantry_match` | M06 |

## Estados obligatorios en cada pantalla
Carga (esqueleto), vacío (con acción), error (reintentar), sin conexión (banner + caché) y — donde aplique — bloqueado por consentimiento (CTA a aceptar).

## Accesibilidad
Etiquetas, orden de foco, contraste AA, objetivo táctil ≥44pt, soporte de texto grande, sin información solo por color, mensajes de error asociados al campo.
