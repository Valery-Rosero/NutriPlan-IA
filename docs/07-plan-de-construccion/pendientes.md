# Pendientes (al 13-nov-2026)

Se avanza **de a un ítem**, en este orden, y cada uno se cierra probado (pruebas + APK) antes de empezar el siguiente. Así el flujo de la app no se ensucia con cambios a medias.

## A. Verificar lo que ya se arregló (primero)
| # | Qué | Estado |
|---|---|---|
| A1 | APK nuevo con los arreglos del 13-nov: teclado del asistente y formularios, lista de mercado al terminar la compra, textos legales sin marcadores, cierre de sesión con tiempo límite | Por probar en el teléfono |
| A2 | Despliegue a staging de la migración `20261113000100_shopping_close_bought` (GitHub → Actions) | Por confirmar |
| A3 | **Verificación por correo:** staging deja crear la cuenta sin verificar porque "Confirm email" está apagado en el panel de Supabase (en `config.toml` se apaga a propósito solo para local/CI) | Encender en el panel de staging y probar |
| A4 | **Cierre de sesión** con diálogo del sistema → diálogo propio de la app (`ConfirmDialog`), también en quitar de la despensa y revocar la autorización | Hecho; probar en el APK |
| A6 | Notificaciones en el APK (recordatorio de comida) | ✅ Probado el 13-nov |
| A7 | Recuperar contraseña: el enlace abría la app "donde quedó" (Supabase volvía a `nutriplan://` sin pantalla). Arreglado con `+native-intent.tsx` (el código va a "Nueva contraseña" llegue por donde llegue); revisar además Redirect URLs del panel de staging | Arreglado; probar en el APK nuevo |
| A5 | Importar el backlog a Jira (Sprint → "No asignar", validar, importar una vez; sprints y estados con las etiquetas) | En curso |

## B. Funciones nuevas (decisiones ya tomadas)
Cada una lleva su ADR, migración (si aplica), pruebas y actualización de `docs/` antes de cerrarse.

### B1. Calendario como libro (Mi semana) — solo app · ✅ hecho (13-nov), probar en el APK
- Arriba, el calendario se adapta al plan: **tira de 7 días** si el plan es de 1 a 7 días; **cuadrícula del mes** si es más largo.
- Al tocar un día se abre su **página**; se pasa de día **deslizando, como hoja de libro**. Sin scroll largo.
- La página muestra las comidas del día (y, cuando exista B3, los extras), con el costo del día. El presupuesto queda como resumen arriba.

### B2. Planear por día, semana o mes · ✅ hecho (13-nov), probar en el APK
- Opciones al generar: **Hoy · Semana · Mes**.
- El generador (`generate_plan`) hoy acepta 1–14 días: extenderlo a **31** y probar el tiempo de respuesta con un mes.
- Depende de B1 para verse bien (cuadrícula del mes).

### B3. Clasificación de alimentos con IA · ✅ hecho (13-nov): B3a función, caché e ítems manuales de la lista; B3b alimentos propios en la despensa (tabla `pantry_custom_items`). Falta desplegar `categorize-food`
- Edge Function `categorize-food` con Gemini Flash-Lite (mismo adaptador que el asistente, ADR-025).
- La IA **solo escoge de listas cerradas** de la base: 16 grupos de alimento, 8 secciones del supermercado y momento del día; además estima calorías y proteína por porción. La base valida la respuesta (ADR-003).
- **Caché** compartida por texto normalizado ("empanada" se clasifica una vez); respaldo con reglas simples si la IA falla; la persona puede corregir la categoría.
- **Sin datos de salud** en el pedido. Lo que la IA deduce de un texto libre **no se usa para filtrar alergias** (solo informa).
- Se usa en tres lugares:
  1. **Antojos y comidas extra** (B4).
  2. **Ítems manuales de la lista** → su sección del supermercado (`shopping_list_items.store_category_id` ya existe).
  3. **Alimentos fuera del catálogo en la despensa** → requiere ampliar `pantry_items` (hoy exige `ingredient_id`): nombre libre, grupo y sección, y revisar la restricción única y las funciones que leen la despensa.

### B4. Antojos y comidas extra en el calendario
- Botón **"Comí algo más"** en la página del día: una receta del catálogo o texto libre (clasificado con B3).
- Se ve en el calendario con su propio estilo (*Antojo*), junto a lo planeado.
- **Cuenta en Mi día como aproximado** (exacto si es del catálogo; estimado por la IA si es texto libre).
- **Opcional:** si es receta del catálogo cocinada en casa, **descuenta la despensa**; si se anota cuánto costó, **suma al gasto del mes** (`record_purchase`).
- Nota técnica: "Cocinar ahora" (`cook_now`) solo admite una comida por momento del día y solo del catálogo; los extras necesitan su propia tabla (`meal_extras`) y su RPC.
- Depende de B1 (dónde se muestran) y B3 (texto libre).

## C. Antes de usuarios reales (sin cambios)
Revisión de un abogado de los textos legales · revisión de una nutricionista (US-121) · validación con 5 personas (US-101) · producción (`drgzvvkkjxqvolcerpjx`) · Google Play (US-158) · monitor de disponibilidad · Gemini en plan de pago con tope de gasto y clave rotada · renovar el token de Supabase del despliegue (cada 90 días).

## Orden sugerido
A1–A5 → B1 → B2 → B3 → B4 → C.
