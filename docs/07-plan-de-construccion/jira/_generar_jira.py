"""Genera nutriplan-jira-scrum.csv para importar el backlog a Jira (Scrum) con su jerarquía:

    Épica  →  Historia / Tarea / Bug  →  Subtarea

Fuente: docs/05-historias-de-usuario/historias.json (las 86 historias) + lo que se construyó de verdad
(sprints, estado y subtareas, según git y docs/07-plan-de-construccion/plan-de-arranque.md).
Uso:  python docs/07-plan-de-construccion/jira/_generar_jira.py
"""
import csv
import json
import pathlib

AQUI = pathlib.Path(__file__).parent
DOCS = AQUI.parent.parent
historias = {s["id"]: s for s in json.loads((DOCS / "05-historias-de-usuario/historias.json").read_text(encoding="utf-8"))}

PRODUCT_GOAL = ("Product Goal: que cada familia o estudiante de Pasto deje de improvisar qué cocinar y planifique sus "
                "comidas con lo que tiene, respetando su salud, sus gustos y su presupuesto.")
EPICAS = {
    1: ("Perfil y personalización", "Captura y mantiene las preferencias, restricciones y ajustes finos de la persona (dieta, alergias, presupuesto, metas, tiempo de cocina, cocinas favoritas) que alimentan cada recomendación.", "M02"),
    2: ("Planificación inteligente de comidas", "Genera, ajusta y explica los planes de comidas: generador por reglas, recetas versátiles, escalado de porciones, asistente con IA y recordatorios.", "M04"),
    3: ("Compras, presupuesto y despensa", "Convierte el plan en una lista de compras útil, controla el gasto frente al presupuesto, reduce el desperdicio y prepara integraciones futuras.", "M06"),
    4: ("Nutrición y feedback", "Información nutricional confiable por receta y por día, y calificaciones que mejoran las próximas recomendaciones.", "M08"),
    5: ("Comunidad y confianza", "Protege los datos sensibles (consentimientos, autorización de datos de salud, derechos del titular) y, más adelante, la comunidad con moderación.", "M01"),
    6: ("Fundamentos, calidad y lanzamiento", "Despliegue automático, registro de fallas, analítica, accesibilidad, rendimiento, validación con usuarios y publicación en Google Play.", "M11"),
}
MODULOS = {s["module"]: s["module_name"] for s in historias.values()}

# --- Sprints (lo que de verdad se entregó en cada uno) --------------------------------------------
SPRINTS = {
    "Sprint 0": "Arranque técnico: monorepo, migraciones sobre Supabase real, CI",
    "Sprint 1": "Cuenta y consentimientos",
    "Sprint 2": "Catálogo versátil, onboarding, perfil y despensa",
    "Sprint 3": "Receta versátil, nutrición y cocinar ahora",
    "Sprint 4": "Plan semanal, cambiar comidas y presupuesto",
    "Sprint 5": "Lista de compras sin conexión",
    "Sprint 6": "Calificaciones, derechos del titular y EAS",
    "Sprint 7": "Rediseño y flujo centrado en la cocina",
    "Sprint 8": "Asistente con IA, sustitutos y soporte",
    "Sprint 9": "Precios reales, gasto, nutrición y calidad",
    "Sprint 10": "Fallas, avisos y despliegue a staging",
    "Sprint 11": "APK, validación y piloto (en curso)",
    "Sprint 12": "Cocina viva, IA en más lugares y cambios a la semana",
    "Sprint 13": "Mi cocina que no se rompe: lista → compra → despensa",
    "Sprint 14": "IA primero: asistente, voz, plan con IA y logo (en curso)",
}
SPRINT_DE = {}
for sprint, ids in {
    "Sprint 0": [102],
    "Sprint 1": [104, 105, 113, 114],
    "Sprint 2": [106, 107, 108, 109, 110, 116, 119, 130, 142],
    "Sprint 3": [111, 115, 118, 123, 143, 156],
    "Sprint 4": [103, 117, 120, 127, 129, 132, 139, 145, 146, 155],
    "Sprint 5": [124, 125, 126, 135],
    "Sprint 6": [128, 133, 134, 144],
    "Sprint 7": [137, 138],
    "Sprint 8": [147, 151, 157, 160, 173],
    "Sprint 9": [112, 131, 136, 140, 141, 152, 159],
    "Sprint 10": [122, 148, 149, 150, 153],
    "Sprint 11": [101, 121, 158],
    "Sprint 12": [174, 175, 176, 177, 178],
    "Sprint 13": [179, 180, 181, 182],
    "Sprint 14": [163, 164, 183, 184, 185, 186],  # 163 y 164 se construyeron en el 12; pasan a medir su precisión en el APK
}.items():
    for i in ids:
        SPRINT_DE[i] = sprint
ESTADO = {101: "To Do", 121: "In Progress", 158: "In Progress", }  # el resto con sprint: Done; sin sprint: To Do

PUNTOS = {101: 5, 102: 8, 103: 5, 104: 8, 105: 3, 106: 3, 107: 5, 108: 2, 109: 2, 110: 13, 111: 8, 112: 5, 113: 5,
          114: 2, 115: 3, 116: 3, 117: 13, 118: 5, 119: 5, 120: 5, 121: 5, 122: 8, 123: 5, 124: 8, 125: 3, 126: 5,
          127: 3, 128: 3, 129: 5, 130: 2, 131: 5, 132: 2, 133: 5, 134: 3, 135: 3, 136: 5, 137: 3, 138: 3, 139: 2,
          140: 5, 141: 5, 142: 2, 143: 2, 144: 2, 145: 2, 146: 3, 147: 5, 148: 8, 149: 3, 150: 5, 151: 5, 152: 5,
          153: 5, 154: 3, 155: 3, 156: 3, 157: 8, 158: 5, 159: 5, 160: 3, 161: 13, 162: 8, 163: 13, 164: 13, 165: 8,
          166: 13, 167: 8, 168: 5, 169: 8, 170: 5, 171: 2, 172: 5, 173: 2, 174: 8,
          175: 8, 176: 8, 177: 5, 178: 8, 179: 8, 180: 5, 181: 8, 182: 5, 183: 8, 184: 5, 185: 2, 186: 13}

COMO_QUEDO = {
    104: "En vez de bloquear 5 intentos por cuenta (Supabase no lo trae), se usan los límites de tasa de Supabase Auth (ADR-019).",
    105: "Pendiente fuera del alcance de la historia: plan de copias de seguridad para producción.",
    112: "Sprint 4: fuente DANE–SIPSA con 3 precios. Sprint 9: 23 precios reales de Pasto (El Potrerillo, nov. 2026) y 12 nacionales de respaldo.",
    121: "Hecha la revisión asistida por IA con fuentes USDA (ADR-021), visible en la app. Falta la revisión de una nutricionista titulada.",
    122: "Registro de fallas propio en vez de Sentry (ADR-026).",
    140: "Cubierto con prueba estática; falta el checklist manual con TalkBack en el APK (tarea del Sprint 11).",
    144: "El comentario es privado y va con la calificación; los comentarios públicos son parte de la comunidad (F3).",
    145: "El generador siempre prioriza despensa y vencimientos; no hizo falta un interruptor.",
    157: "Gemini Flash-Lite con salida estructurada y sin datos de salud en el prompt (ADR-025).",
    158: "APK de staging compilado con EAS e instalado en un teléfono real (Honor 200, Android 16); faltan la cuenta y la prueba cerrada en Google Play.",
    163: "Construida en el Sprint 12 (ADR-032); probada con fotos reales en el APK en el Sprint 14.",
    164: "Construida en el Sprint 12 (ADR-032); probada con recibos reales en el APK en el Sprint 14.",
    174: "La IA solo traduce la frase a una meta; las cifras y la seguridad las pone la base (ADR-031).",
    175: "B1 y B2: el mes de 30 días se generaba en ~4 s; en el Sprint 14 bajó a ~0,6 s (bug 320).",
    176: "ADR-027 y ADR-030. Los alimentos propios no entran en recetas, plan, lista ni avisos (limitación documentada).",
    177: "ADR-028. Antes, cocinar ahora pisaba la comida planeada (bug 312).",
    178: "ADR-029. La receta del asistente es un borrador privado; la base la revalida antes de guardarla.",
    179: "ADR-033. Nace de probar la app en el teléfono: el ciclo lista → compra → despensa se rompía.",
    180: "ADR-034.",
    181: "ADR-035.",
    182: "ADR-036.",
    183: "ADR-037: amplía la ADR-025 (la IA sabe qué evitar, nunca por qué). Política de datos v3.",
    184: "ADR-038. Antes hubo una pista para dictar con el teclado (tarea 233); el botón propio se hizo al pedirlo la PO.",
    185: "Pedida por la PO al probar la lista; también funciona dictando.",
    186: "ADR-039. plan-ai desplegada en staging y probada en el APK (\"Hecho con IA\").",
}

# --- Subtareas por historia: (título, estado). Sin estado = el de la historia. ------------------------
SUB = {
    101: ["Guion de prueba con 3 tareas: alergias, cambiar comida, lista", "Reclutar 5 participantes (al menos 1 con alergia)", "Hacer las 5 sesiones con el APK", "Informe de hallazgos y nuevos ítems del backlog"],
    102: ["CI en GitHub Actions: lint, tipos, Jest y pruebas SQL", "Supabase local en CI (con storage-api)", "Despliegue a staging: db push y Edge Functions", "Secretos del despliegue y verificación previa"],
    103: ["Comparar motor con LLM vs. reglas (costo y latencia)", "ADR-018: el plan se arma con reglas", "ADR-023: el generador vive en SQL"],
    104: ["Pantallas de bienvenida, registro e inicio de sesión", "Reglas de contraseña con indicador en vivo", "Verificación de correo con reenvío", "Recuperar contraseña con enlace PKCE", "Límites de intentos con Supabase Auth (ADR-019)"],
    105: ["Verificar TLS y cifrado en reposo de Supabase", "Datos de salud separados en profile_health con RLS", "Documento de verificación US-105", "ADR-008: sin cifrado por campo en el MVP"],
    106: ["Catálogo de dietas y sus exclusiones", "Paso de dieta en el onboarding", "RPC set_my_restrictions", "Pruebas de exclusión por dieta"],
    107: ["Paso de alergias con autorización de datos sensibles", "Trigger que exige la autorización vigente", "Filtro duro de alérgenos en eligible_recipes", "Prueba de contenido: ninguna receta viola alergias"],
    108: ["Paso de presupuesto por semana o mes en COP", "Validación de montos", "Pruebas del formulario"],
    109: ["Paso de hogar: región y número de personas", "Porciones por defecto en recetas y plan", "Pruebas"],
    110: ["52 ingredientes con nutrición USDA y alérgenos revisados", "16 recetas colombianas versátiles con grupos intercambiables", "Cargar el catálogo como seed", "Prueba de cobertura por dieta y alergia"],
    111: ["Nutrición por 100 g de cada ingrediente", "Vista recipe_nutrition por porción", "Pruebas del cálculo"],
    112: ["Registrar la fuente DANE–SIPSA", "3 precios mayoristas verificados", "23 precios reales de Pasto (El Potrerillo, nov. 2026)", "12 precios nacionales de respaldo"],
    113: ["Casillas no premarcadas: 18+, términos y política", "Aviso de privacidad visible en el registro", "Consentimientos versionados con hash", "Re-aceptación de versiones nuevas"],
    114: ["Aviso de salud antes de usar la app", "Pie fijo en Mi semana y Perfil"],
    115: ["Bloque de nutrición en el detalle de receta", "Nutrición escalada a las porciones", "Pruebas de la pantalla"],
    116: ["Perfil como resumen con filas editables", "Reutilizar los formularios del onboarding", "Revocar la autorización con advertencia (R4)"],
    117: ["RPC generate_plan con reglas en SQL", "Guardado atómico con save_generated_plan", "Pantalla Mi semana con el plan", "Pruebas: elegibilidad, variedad y motivo"],
    118: ["Selector de porciones de 1 a 12", "RPC preview_recipe: todo se calcula en la base", "Marcado 'lo tienes / te falta'"],
    119: ["Pantalla de despensa", "Agregar con búsqueda sin tildes y unidades (g, kg, lb, unidad)", "Editar y quitar ítems", "Pruebas"],
    120: ["Precios por región (ingredient_prices)", "RPC recipe_cost con precios faltantes y estimados", "Pruebas de costo"],
    121: [("Revisión asistida por IA con fuentes USDA (ADR-021)", "Done"), ("Mostrar en la app el estado de la revisión", "Done"),
          ("Revisión de recetas y alérgenos con nutricionista titulada", "To Do"), ("Registrar la revisión en nutritionist_reviews", "To Do")],
    122: ["Tabla app_errors y RPC report_app_error", "Limpieza de datos en la app y en un trigger", "ErrorBoundary y manejador global de errores", "Alerta por correo cada 5 min (error-alert + Resend)", "ADR-026: registro propio en vez de Sentry"],
    123: ["Cocinar desde el plan (cook_planned_meal)", "Cocinar ahora sin plan (cook_now)", "Descontar despensa, primero lo que vence", "Deshacer dentro de 10 s"],
    124: ["RPC generate_shopping_list desde el plan", "Pantalla de lista de mercado", "Pruebas"],
    125: ["Restar la despensa vigente", "Los básicos (sal, aceite, agua) no llenan la lista"],
    126: ["Marcar con actualización optimista", "Cola sin conexión que se sincroniza (ADR-014)", "Quitar y agregar ítems manuales", "Pasar lo comprado a la despensa"],
    127: ["RPC plan_budget_status", "Tarjeta de costo en Mi semana"],
    128: ["Formulario de estrellas, etiquetas y comentario", "RPC rate_meal (solo después de cocinar)", "Pruebas"],
    129: ["Pantalla Cambiar comida con alternativas elegibles", "Omitir y confirmar el plan", "Regenerar archiva lo ya cocinado"],
    130: ["Botón 'Completar después' en el onboarding", "Aviso permanente si no hay alergias declaradas"],
    131: ["Tabla analytics_events anónima (ADR-015)", "Identificador anónimo en el teléfono", "Interruptor de analítica en Privacidad", "Eventos de las funciones clave"],
    132: ["Alertas 'cerca' y 'se pasa' del presupuesto", "Conteo honesto de precios faltantes"],
    133: ["Exportar mis datos (export_my_data y compartir)", "Edge Function delete-account", "Confirmación escribiendo ELIMINAR", "Prueba de punta a punta en local"],
    134: ["Lo calificado con 1–2 estrellas no vuelve en 60 días", "Lo calificado con 4–5 sube en el plan (high_rating)"],
    135: ["Secciones del supermercado en la lista", "Lo que ya se tiene va aparte", "Vista my_shopping_items con unidades aproximadas"],
    136: ["Meta de proteína y calorías en Preferencias", "Exigir autorización de datos sensibles (trigger)", "El plan prefiere recetas cerca de la meta (macro_fit)"],
    137: ["Tiempo máximo en Preferencias", "Aviso cuando una receta pasa el tiempo", "El plan respeta el tiempo máximo"],
    138: ["Tabla user_cuisines y RPC set_my_cuisines", "Selector de cocinas favoritas", "El plan prefiere las favoritas (cuisine_favorite)"],
    139: ["Opción 'solo hoy' al generar el plan", "Pruebas"],
    140: ["Etiquetas de accesibilidad en todos los controles", "Letra al 200 % sin cortes", "Prueba estática de accesibilidad", "Checklist manual documentado"],
    141: ["RPC record_purchase y monthly_spend", "Registrar lo pagado desde la lista", "Tarjeta de gasto del mes"],
    142: ["Vencimientos rápidos al agregar a la despensa", "Vida útil por defecto al pasar compras a la despensa"],
    143: ["Datos de fibra, azúcar y sodio en el catálogo", "Micronutrientes por porción en la receta"],
    144: ["Etiquetas rápidas ('muy salado', 'tardó más')", "Comentario opcional de hasta 200 caracteres"],
    145: ["El generador prioriza despensa y vencimientos", "Motivos pantry_match y pantry_expiring"],
    146: ["Regla de variedad: sin repetir proteína en días seguidos", "Pruebas del generador"],
    147: ["Tabla de sustituciones con proporción", "RPC suggest_substitutes_for y substitute_shopping_item", "Deshacer la sustitución", "Sustitutos en la lista de mercado"],
    148: ["Preferencias y dispositivos (push_devices)", "Programar avisos con pg_cron", "Edge Function send-notifications con Expo Push", "Permiso en contexto; tocar el aviso abre la receta", "Firebase (FCM v1) en EAS"],
    149: ["Frecuencia: diarios, solo resumen semanal o ninguno", "Minutos de anticipación"],
    150: ["Medir y reducir el tiempo de arranque", "Abrir sin conexión con la caché (computeGates)", "Carga con reintento cuando no hay red"],
    151: ["Tabla support_tickets", "Pantalla de Ayuda con tipo y descripción", "Captura opcional en bucket privado"],
    152: ["RPC plan_savings: una sugerencia por alternativa, sin días seguidos", "Panel de ahorro en Mi semana", "Aplicar el reemplazo"],
    153: ["Detectar lo que vence en 2 días", "Aviso con una receta que lo use", "Resumen semanal de los domingos"],
    154: ["Documento de consentimiento de comunidad", "Pantalla para aceptar o revocar", "Bloquear publicar sin consentimiento"],
    155: ["reason_code asignado por reglas, nunca por el LLM", "Mostrar el motivo en cada comida"],
    156: ["Exponente de escalado por ingrediente (sal, especias, aceite)", "Fórmula base × (porciones/base)^exponente en preview_recipe"],
    157: ["Edge Function assistant-chat con Gemini y responseSchema", "Candidatas seguras desde cook_with_what_i_have", "Respaldo determinista y cuota de 30 por día", "Pantalla del asistente y aplicar la sugerencia", "ADR-025: Gemini Flash-Lite sin datos de salud"],
    158: [("Perfiles de EAS (APK y paquete de tienda)", "Done"), ("Permisos mínimos y guía de publicación", "Done"),
          ("Compilar y probar el APK de staging", "Done"), ("Cuenta de Google Play y ficha de la tienda", "To Do"), ("Prueba cerrada en Google Play", "To Do")],
    159: ["RPC daily_nutrition", "Tarjeta Mi día en Hoy", "Pruebas"],
    160: ["Modo 'solo con lo que tengo' (pantry_only)", "Decir qué falta si no alcanza"],
    161: ["ADR y migración de hogares y miembros con RLS", "Invitar a otra persona y compartir la lista", "Pruebas de RLS por hogar"],
    162: ["ADR y modelo de porciones sobrantes", "Sugerir recetas con las sobras", "Pruebas"],
    163: [("Spike: modelo de visión y costo", "Done"), ("Reconocer ingredientes desde la cámara", "Done"),
          ("Confirmar antes de agregar a la despensa", "Done"), ("Medir la precisión con fotos reales en el APK", "Done")],
    164: [("Spike: OCR de recibos de Pasto", "Done"), ("Leer el recibo y registrar el gasto", "Done"),
          ("Confirmar ítems antes de guardar", "Done"), ("Medir la precisión con recibos reales en el APK", "Done")],
    165: ["ADR y migración de precios por tienda", "Elegir supermercado en el perfil", "Pruebas de costo por tienda"],
    166: ["Spike: integraciones con supermercados", "Enviar la lista como pedido", "Pruebas"],
    167: ["Migración de recetas de la comunidad con RLS", "Pantalla para publicar una receta o adaptación", "Validar alérgenos antes de publicar"],
    168: ["Comentarios y tips públicos", "Reportar contenido", "Pruebas"],
    169: ["Rol moderator y cola de reportes", "Acciones de moderación en Supabase Studio", "Pruebas de permisos"],
    170: ["Recetas aptas para batch cooking", "Modo batch en el plan", "Pruebas"],
    171: ["Nivel de picante en Preferencias", "Filtrar por recipe_max_heat"],
    172: ["ADR y tabla recipe_variants", "Mostrar la versión rápida en la receta"],
    173: ["Respuestas rápidas sugeridas en el chat"],
    174: ["RPC propose_week_changes y apply_week_changes con pruebas SQL", "Modo semana en assistant-chat (la IA traduce, la base calcula)", "Pantalla Revisa los cambios y Mejorar mi semana", "Probar en el APK con Gemini en staging"],
    175: ["Calendario de 7 días o del mes con un punto por día", "Un día por página que gira como un libro (sin giro con reducir movimiento)", "generate_plan de 1 a 31 días", "Selector Hoy · Semana · Mes"],
    176: ["Edge Function categorize-food: caché, catálogo, IA con listas cerradas y reglas", "Alimentos propios fuera del catálogo (pantry_custom_items)", "Edge Function understand-pantry: separar un texto libre en varias cosas", "Grupo sugerido visible y corregible en Lo que tengo"],
    177: ["planned_meals.is_extra y una comida planeada por momento", "Cocinar ahora suma un plato adicional", "Sección Adicionales en Mi semana", "Opciones de la receta: En tu cocina / Para comprar"],
    178: ["assistant_ingredients: solo lo que la persona puede comer", "create_assistant_recipe revalida y guarda un borrador privado", "Hasta tres opciones por mensaje", "Respuesta con formato y tarjetas deslizables"],
    179: ["add_ingredients_to_list con gramos", "Reconocer lo escrito a mano al pasarlo a la despensa", "La cocina cambió (kitchen-sync): rehacer la lista y refrescar", "what_to_buy_next en gramos"],
    180: ["adjust_pantry y set_pantry_expiry", "Una fila por alimento (total y fecha más próxima)", "Lo vencido: Todavía sirve / Quitar lo vencido", "Fecha propuesta según cuánto dura el alimento"],
    181: ["Lista de la casa sin plan (my_house_list)", "Cantidades como se venden (private.purchase)", "Quitar con deshacer (dismissed_at)", "Presupuesto del mes redondeado"],
    182: ["Encabezado de una fila en Mi cocina", "Agregar por Buscar, Escribir o Foto", "Lo que tengo carga sin señal", "Agregado rápido desde la base (quick_add_items)"],
    183: ["Acción chat: 4–5 platos distintos", "Acción fill: la IA llena la receta y la base la valida", "assistant_profile y lista \"no usar\" sin el porqué", "Receta completa en el chat con kcal, proteína y costo de la base", "Ideas del recetario si la IA no responde"],
    184: ["Botón de micrófono junto a enviar", "Reconocimiento de voz del teléfono en es-CO", "Permiso de micrófono (RECORD_AUDIO)", "Política de datos v3: la voz no se graba ni se guarda"],
    185: ["Separar por comas y por \"y\"", "Aviso de cuáles se van a agregar", "Cada producto en su sección"],
    186: [("Edge Function plan-ai: menú, recetas y guardado", "Done"), ("Reparto sin repetir plato en días seguidos, primero lo que vence", "Done"),
          ("Mi semana: Planear con IA, avance real y Hecho con IA", "Done"), ("Desplegar plan-ai a staging", "Done"),
          ("Probar la semana y el mes con IA en el APK", "Done")],
}

# --- Tareas técnicas y bugs (cuelgan de una épica). (id, tipo, épica, sprint, estado, puntos, título, descripción, módulo, subtareas)
OTROS = [
    (201, "Task", 6, "Sprint 0", "Done", 3, "Monorepo app/backend/docs, AGENTS.md y unificar la copia de Supabase", "Una sola fuente para el backend (C4).", "M11", []),
    (202, "Task", 5, "Sprint 0", "Done", 5, "Migración de refuerzo (hardening R1–R9) y runner de pruebas SQL", "Dietas como filtro duro, guardado atómico del plan y runner multiplataforma run_local.sh.", "M01", []),
    (203, "Task", 2, "Sprint 0", "Done", 8, "Recetas versátiles: base + grupos intercambiables (ADR-020)", "Las opciones de cada grupo se resuelven con la despensa y nunca con un ingrediente prohibido.", "M03", []),
    (204, "Task", 6, "Sprint 1", "Done", 5, "Arquitectura de la app por capas con puertos y adaptadores (ADR-022)", "domain / data / application / ui por feature e inyección de servicios.", "M11", []),
    (205, "Task", 6, "Sprint 6", "Done", 5, "Prueba de integración del recorrido completo contra Supabase real", "Registro → onboarding → plan → compras → cocinar, en CI.", "M11", []),
    (206, "Task", 2, "Sprint 7", "Done", 5, "Flujo centrado en la cocina: Hoy · Mi cocina · Mi semana (ADR-024)", "La pregunta principal es '¿qué cocino con lo que tengo?'.", "M04", []),
    (207, "Task", 6, "Sprint 7", "Done", 13, "Rediseño visual de la app", "Sistema de diseño con la paleta de marca, modo oscuro y componentes compartidos; luego cada pantalla.", "M11",
     ["Sistema de diseño: tokens, tipografía y componentes", "Selector de tema: como el teléfono, claro u oscuro", "Pantallas de acceso", "Hoy", "Mi cocina", "Mi semana", "Detalle de receta", "Onboarding y consentimientos", "Perfil, privacidad y eliminar cuenta"]),
    (208, "Task", 5, "Sprint 10", "Done", 3, "Correos de la cuenta en español con SMTP de Gmail", "Plantillas con la marca para confirmar, recuperar y cambiar correo; sin comprar dominio.", "M01", []),
    (209, "Task", 6, "Sprint 10", "Done", 3, "Vincular el proyecto a EAS y Firebase (FCM) para el APK", "projectId de EAS, llave FCM v1 en eas credentials.", "M11", []),
    (210, "Task", 6, "Sprint 10", "Done", 5, "Desplegar todo a staging", "Migraciones, catálogo con precios, Edge Functions, secretos, alertas y avisos.", "M11", []),
    (211, "Task", 5, "Sprint 10", "Done", 2, "Sacar google-services.json del repositorio público", "Ignorado por Git y guardado como variable secreta de tipo archivo en EAS (GOOGLE_SERVICES_JSON).", "M11", []),
    (212, "Task", 6, "Sprint 10", "Done", 3, "Poner la documentación al día con F2", "Modelo de datos regenerado, RPC, arquitectura, seguridad, pantallas y limitaciones.", "M11", []),
    (220, "Task", 6, "Sprint 11", "Done", 2, "Compilar el APK de staging con EAS", "npx eas-cli build -p android --profile preview", "M11", []),
    (221, "Task", 6, "Sprint 11", "Done", 3, "Probar el APK en un teléfono real", "Arranque < 3 s, avisos, recorrido completo y checklist de accesibilidad. La PO lo prueba en un Honor 200 (Android 16) desde el 13-nov.", "M11",
     [("Arranque en menos de 3 s (US-150)", "Done"), ("Activar avisos y recibir uno (US-148)", "Done"),
      ("Recorrido completo de punta a punta", "Done"), ("Letra al 200 % y TalkBack (US-140)", "To Do")]),
    (222, "Task", 5, "Sprint 11", "To Do", 5, "Completar los textos legales y pedir revisión de un abogado", "Llenar los marcadores de los 6 borradores y nombrar a los encargados de datos.", "M01", []),
    (223, "Task", 6, "Sprint 11", "To Do", 2, "Pasar Gemini a plan de pago con tope de gasto y rotar su clave", "El plan gratuito puede usar los datos para mejorar sus modelos.", "M05", []),
    (224, "Task", 6, "Sprint 11", "To Do", 5, "Configurar producción", "Migraciones, funciones, secretos, SMTP y plantillas en el proyecto de producción.", "M11", []),
    (225, "Task", 6, "Sprint 11", "To Do", 1, "Monitor de disponibilidad (UptimeRobot)", "Aviso si Supabase o las funciones dejan de responder.", "M11", []),
    (226, "Task", 6, "", "To Do", 1, "Renovar el token de acceso de Supabase del despliegue", "Vence cada 90 días; actualizar el secreto SUPABASE_ACCESS_TOKEN en GitHub.", "M11", []),
    (227, "Task", 5, "", "To Do", 5, "Evaluación de impacto de privacidad y contratos con proveedores", "Circular SIC 002/2024 (IA + salud); Supabase, Google, Expo y Resend.", "M01", []),
    (228, "Task", 4, "", "To Do", 2, "Pedir permiso escrito al ICBF para la tabla TCAC", "Mientras tanto se usa USDA (CC0).", "M03", []),
    # Sprint 12
    (229, "Task", 6, "Sprint 12", "Done", 13, "Rediseño «Cocina viva»", "Paleta de alimentos (tomate, mora, albahaca, mango), letra, componentes y barra flotante; luego cada pantalla.", "M11",
     ["Paleta, letra y componentes", "Barra de pestañas flotante", "Hoy", "Mi cocina", "Mi semana", "Receta", "Perfil", "Bienvenida, acceso y onboarding"]),
    (230, "Task", 1, "Sprint 12", "Done", 3, "Onboarding de 7 pasos: preferencias y avisos al crear la cuenta", "\"¿Cómo te gusta cocinar?\" y \"¿Te avisamos?\"; el permiso del teléfono solo se pide al tocar \"Activar avisos\".", "M02", []),
    (231, "Task", 5, "Sprint 12", "Done", 2, "Términos y Política desplegables dentro del registro", "Se leen ahí mismo sin perder lo escrito; se anuncian al lector de pantalla.", "M01", []),
    (232, "Task", 6, "Sprint 12", "Done", 2, "Diálogo de confirmación con el diseño de la app", "ConfirmDialog en lugar de la alerta del sistema: cerrar sesión, quitar de la despensa y revocar la autorización.", "M11", []),
    (233, "Task", 2, "Sprint 12", "Done", 1, "Pista para dictar con el micrófono del teclado", "Primer paso de la voz: el teclado de Android ya dicta sin permisos ni costo.", "M05", []),
    (234, "Task", 6, "Sprint 12", "Done", 2, "Pruebas estables con la caché fría", "Sin fallas al azar por tiempo: maxWorkers 50 % y esperas más largas; la suite baja de ~150 s a ~74 s.", "M11", []),
    # Sprint 13
    (235, "Task", 6, "Sprint 13", "Done", 2, "Documentación de Mi cocina al día", "ADR-033 a ADR-036, funciones RPC, reglas de negocio, pantallas y modelo de datos regenerado.", "M11", []),
    # Sprint 14
    (236, "Task", 6, "Sprint 14", "Done", 3, "Pantallas compactas: Asistente y Mi semana", "Encabezado de una fila (como en Hoy y Mi cocina); en Mi semana fechas cortas y \"Volver a generar\" plegado.", "M11", []),
    (237, "Task", 5, "Sprint 14", "Done", 2, "Política de tratamiento de datos v3", "Voz y lo que sabe el asistente (preferencias y \"no usar\" sin el porqué); se vuelve a pedir la aceptación.", "M01", []),
    (238, "Task", 6, "Sprint 14", "Done", 5, "Logo de NutriPlan IA con los colores de la app", "Propuesta de la PO llevada a la paleta «Cocina viva»: hoja en tomate, puntos de la IA en mora.", "M11",
     ["Símbolo y palabra con los colores de la app (claro y oscuro)", "Ícono de la app: adaptable y monocromo de Android", "Arranque con el logo principal y el lema", "Logo en Hoy, bienvenida, ingreso y registro"]),
    (239, "Task", 6, "Sprint 14", "Done", 1, "Compilar e instalar el APK con el logo y el plan con IA", "npx eas-cli build -p android --profile preview; instalar en el teléfono de prueba.", "M11", []),
    (240, "Task", 6, "Sprint 14", "Done", 1, "Desplegar plan-ai y assistant-chat v2 a staging", "supabase functions deploy con el proyecto de staging.", "M11", []),
    (241, "Task", 6, "Sprint 14", "To Do", 2, "Logo en más lugares", "Ícono de las notificaciones, Perfil › Acerca de y el nombre \"NutriPlan IA\" bajo el ícono del teléfono.", "M11", []),
    (243, "Task", 5, "Sprint 14", "Done", 3, "Correos de la cuenta con el logo y los colores de «Cocina viva»", "Logo en PNG (Gmail no muestra SVG), tarjeta blanca, botón tomate y pie con el lema; tablas y estilos en línea. Los enlaces no cambian.", "M01", []),
    (244, "Task", 5, "Sprint 14", "Done", 3, "Página «tu correo quedó confirmado» en GitHub Pages (ADR-040)", "Supabase confirma y devuelve a web/confirmado: en el celular abre la app con la sesión; en el computador dice que ya quedó.", "M01", []),
    (242, "Task", 2, "Sprint 14", "To Do", 2, "Poner una receta en Mi semana eligiendo día y momento", "Para recetas que se abren sin una comida destino (por ejemplo, desde el asistente).", "M04", []),
    (301, "Bug", 1, "Sprint 7", "Done", None, "Los enlaces de correo fallaban: PKCE sin SHA-256 en React Native", "Verificar el correo y recuperar la contraseña no abrían la sesión.", "M01", []),
    (302, "Bug", 4, "Sprint 7", "Done", None, "El botón de enviar la calificación no se habilitaba y no decía por qué", "Ahora explica qué falta para poder enviar.", "M08", []),
    (303, "Bug", 2, "Sprint 8", "Done", None, "El asistente se quedaba esperando con el modelo Flash del plan gratuito", "Se usa el alias gemini-flash-lite-latest (~2 s), que además no se retira.", "M05", []),
    (304, "Bug", 3, "Sprint 9", "Done", None, "Los reemplazos para ahorrar proponían la misma receta varias veces", "Una sugerencia por alternativa y nunca en días seguidos; redondeo corregido.", "M07", []),
    (305, "Bug", 6, "Sprint 10", "Done", None, "Sin conexión la app se quedaba en la pantalla de carga", "Las puertas de arranque ahora entran con la caché (computeGates).", "M11", []),
    (306, "Bug", 6, "Sprint 10", "Done", None, "La CI fallaba desde el reporte de problemas", "El servicio de almacenamiento estaba excluido del Supabase local de CI.", "M11", []),
    (307, "Bug", 6, "Sprint 10", "Done", None, "El despliegue a staging nunca terminaba", "Faltaban secretos y la CLI v3 necesita --remote y --yes.", "M11", []),
    (308, "Bug", 6, "Sprint 12", "Done", None, "En Android el teclado tapaba la caja del chat y los campos", "Android es edge-to-edge desde el SDK 57; KeyboardAvoidingView con padding en ambas plataformas.", "M11", []),
    (309, "Bug", 3, "Sprint 12", "Done", None, "Al terminar la compra la lista no se vaciaba", "Lo que pasó a la despensa sale de la lista; si se compró todo, \"¡Compraste todo!\".", "M06", []),
    (310, "Bug", 1, "Sprint 12", "Done", None, "Cerrar sesión se quedaba esperando", "La baja de avisos se abandona a los 4 s y, si cerrar falla, se avisa.", "M01", []),
    (311, "Bug", 1, "Sprint 12", "Done", None, "El enlace de recuperar contraseña no abría «Nueva contraseña»", "Si Supabase vuelve sin pantalla, la app reescribe el enlace (+native-intent).", "M01", []),
    (312, "Bug", 2, "Sprint 12", "Done", None, "«Cocinar ahora» reemplazaba la comida planeada o fallaba", "Ahora suma un plato adicional (US-177, ADR-028).", "M04", []),
    (313, "Bug", 2, "Sprint 12", "Done", None, "Tocar una opción ya elegida de la receta no hacía nada", "Lo elegido lleva ✓ y ✕ y se puede quitar.", "M03", []),
    (314, "Bug", 3, "Sprint 13", "Done", None, "Lo escrito a mano en la lista no ofrecía «Pasar a la despensa» ni el campo de lo pagado", "El contador lo dejaba fuera desde la ADR-033.", "M06", []),
    (315, "Bug", 3, "Sprint 13", "Done", None, "Los avisos de la compra no se limpiaban", "Se limpian con lo siguiente que se hace en la lista.", "M06", []),
    (316, "Bug", 3, "Sprint 13", "Done", None, "El teclado tapaba «Agregar algo más» en la lista", "La lista se encoge con el teclado y se desplaza hasta el campo.", "M06", []),
    (317, "Bug", 2, "Sprint 13", "Done", None, "Mi semana dejaba un hueco grande antes de «Mejorar mi semana»", "El libro de días mide lo que mide el día que se ve.", "M04", []),
    (318, "Bug", 3, "Sprint 13", "Done", None, "«Lo típico» desaparecía con la cocina llena", "Siempre se ve; lo que ya está dice \"ya tienes\".", "M06", []),
    (319, "Bug", 3, "Sprint 13", "Done", None, "Decía «Vence en 0 días» en vez de «Vence hoy»", "", "M06", []),
    (320, "Bug", 2, "Sprint 14", "Done", None, "Generar el mes fallaba en staging con «Algo salió mal»", "Pasaba el límite de 8 s; generate_plan calcula una vez por momento del día: de ~5 s a ~0,6 s.", "M04", []),
    (321, "Bug", 2, "Sprint 14", "Done", None, "«Omitir» una comida no respondía", "Ahora es optimista y, si la base no lo acepta, vuelve y muestra el error.", "M04", []),
    (322, "Bug", 4, "Sprint 14", "Done", None, "El teclado tapaba el comentario de la calificación", "Al abrir el teclado la pantalla baja lo justo hasta el campo (useKeepFocusedVisible).", "M08", []),
    (323, "Bug", 6, "Sprint 14", "Done", None, "Franja vacía arriba en las pantallas con flecha de volver", "Screen repetía el margen de la barra de estado bajo el encabezado del sistema.", "M11", []),
    (324, "Bug", 1, "Sprint 14", "Done", None, "Recuperar contraseña no dejaba escribir la nueva: la app volvía a Hoy", "El navegador raíz se desmontaba al abrir la sesión; holdGates conserva las puertas mientras se recalculan.", "M01", []),
    (325, "Bug", 1, "Sprint 14", "Done", None, "«Activando tu cuenta» se quedaba cargando", "auth-callback pasa al grupo «sin sesión»: el navegador lleva solo a la app cuando las puertas deciden.", "M01", []),
]

VERSION = {0: "v1.0 MVP", 1: "v1.0 MVP", 2: "v1.1 Mejora y retención", 3: "v2.0 Comunidad e integraciones"}


def version_de_sprint(sprint):
    if not sprint:
        return "v2.0 Comunidad e integraciones"
    return "v1.0 MVP" if int(sprint.split()[1]) <= 6 else "v1.1 Mejora y retención"


def componente(m):
    return f"{m} {MODULOS[m]}"


COLS = ["Issue ID", "Issue Type", "Summary", "Parent", "Status", "Resolution", "Priority", "Story Points", "Sprint",
        "Fix Version", "Component"] + ["Labels"] * 8 + ["Description"]
ESTADO_LABEL = {"To Do": "estado-por-hacer", "In Progress": "estado-en-curso", "Done": "estado-hecho"}
PRIORIDAD_LABEL = {"High": "prioridad-alta", "Medium": "prioridad-media", "Low": "prioridad-baja"}
filas = []


def fila(iid, tipo, resumen, padre="", estado="To Do", prioridad="", puntos=None, sprint="", version="", comp="", labels=(), desc=""):
    # Etiquetas de respaldo: en proyectos team-managed el importador no trae Estado, Prioridad, Componente
    # ni Versión; con ellas se filtra (JQL) y se cambian en bloque después de importar.
    respaldo = [f"sprint-{sprint.split()[1]}" if sprint else "", ESTADO_LABEL[estado], PRIORIDAD_LABEL.get(prioridad, ""),
                version.split()[0] if version else "", comp.split()[0].lower() if comp else ""]
    labels = list(dict.fromkeys(l for l in respaldo + list(labels) if l))[:8]
    filas.append([iid, tipo, resumen, padre, estado, "Done" if estado == "Done" else "", prioridad,
                  "" if puntos is None else puntos, sprint, version, comp] + labels + [""] * (8 - len(labels)) + [desc])


sub_id = 1000


def subtareas(padre_id, items, estado_padre, comp):
    global sub_id
    for it in items:
        titulo, estado = it if isinstance(it, tuple) else (it, estado_padre)
        sub_id += 1
        fila(sub_id, "Sub-task", titulo, padre_id, estado, comp=comp)


# Épicas
for eid, (nombre, desc, mod) in EPICAS.items():
    fila(eid, "Epic", nombre, estado="In Progress", prioridad="High", comp=componente(mod), labels=[f"E{eid}"],
         desc=f"{PRODUCT_GOAL}\n\n{desc}")

# Historias
for hid in sorted(historias):
    s = historias[hid]
    sprint = SPRINT_DE.get(hid, "")
    estado = ESTADO.get(hid, "Done" if sprint else "To Do")
    criterios = "\n".join(f"# {' '.join(c['lines'])}" for c in s["criteria"])
    partes = [f"*Como* {s['rol'].lower()}, *quiero* {s['quiero']}, *para* {s['para']}.", "", "*Criterios de aceptación*", criterios]
    if s["deps"]:
        partes += ["", "*Depende de:* " + ", ".join(f"US-{d}" for d in s["deps"])]
    if hid in COMO_QUEDO:
        partes += ["", f"*Cómo quedó:* {COMO_QUEDO[hid]}"]
    partes += ["", f"Ficha completa: docs/05-historias-de-usuario ({s['key']})."]
    tipo_label = {"spike": "spike", "enabler": "enabler"}.get(s["type"], "historia")
    fila(hid, "Story", f"{s['key']} · {s['title']}", s["epic_id"], estado, s["priority"], PUNTOS[hid], sprint,
         VERSION[s["phase"]], componente(s["module"]), [f"F{s['phase']}", tipo_label] + s["labels"], "\n".join(partes))
    subtareas(hid, SUB[hid], estado, componente(s["module"]))

# Tareas y bugs
for iid, tipo, epica, sprint, estado, puntos, titulo, desc, mod, subs in OTROS:
    fila(iid, tipo, titulo, epica, estado, "Medium" if tipo == "Task" else "High", puntos, sprint,
         version_de_sprint(sprint), componente(mod), ["tecnica" if tipo == "Task" else "bug"], desc)
    subtareas(iid, subs, estado, componente(mod))

salida = AQUI / "nutriplan-jira-scrum.csv"
with salida.open("w", encoding="utf-8", newline="") as f:
    w = csv.writer(f, quoting=csv.QUOTE_ALL)
    w.writerow(COLS)
    w.writerows(filas)

conteo = {}
for r in filas:
    conteo[r[1]] = conteo.get(r[1], 0) + 1
ids = [r[0] for r in filas]
assert len(ids) == len(set(ids)), "Issue ID repetido"
assert all(r[3] == "" or r[3] in ids for r in filas), "Parent sin su Issue ID"
assert set(SUB) == set(historias), f"Historias sin subtareas: {set(historias) - set(SUB)}"
print(salida.name, conteo, "total", len(filas))
for sp in SPRINTS:
    pts = sum(r[7] for r in filas if r[8] == sp and isinstance(r[7], int) and r[1] == "Story")
    print(f"  {sp}: {pts} puntos de historia")
