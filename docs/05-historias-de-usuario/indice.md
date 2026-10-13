# Índice de historias de usuario

Fuente de verdad legible por máquina: `historias.json` (y `historias.csv`). 73 historias, 82 subtareas. El orden del backlog (#) es la prioridad de construcción dentro de cada fase.

| # | ID | Título | Épica | Módulo | Fase | Prio | Tipo | Deps |
|---|---|---|---|---|---|---|---|---|
| 1 | US-101 | Validar el prototipo con usuarios reales antes de construir | E6 | M11 | F0 | High | enabler | — |
| 2 | US-102 | Desplegar versiones nuevas de forma automática y segura | E6 | M11 | F0 | High | enabler | — |
| 3 | US-103 | Spike: validar la arquitectura del motor de recomendación | E2 | M04 | F0 | High | spike | — |
| 4 | US-104 | Crear cuenta e iniciar sesión | E1 | M01 | F0 | High | historia | — |
| 5 | US-105 | Cifrar datos de salud sensibles (reposo y tránsito) | E5 | M01 | F0 | High | historia | — |
| 12 | US-112 | Spike: validar fuentes de precios de alimentos para la región piloto | E3 | M07 | F0 | High | spike | — |
| 13 | US-113 | Aceptar la política de privacidad y tratamiento de datos al registrarme | E5 | M01 | F0 | High | historia | US-104 |
| 14 | US-114 | Informar que la app no reemplaza el consejo médico o nutricional | E4 | M01 | F0 | High | historia | — |
| 6 | US-106 | Seleccionar tipo de dieta en el onboarding | E1 | M02 | F1 | High | historia | US-104 |
| 7 | US-107 | Declarar alergias alimentarias como restricción dura | E1 | M02 | F1 | High | historia | US-104 |
| 8 | US-108 | Declarar presupuesto semanal o mensual de comida | E1 | M02 | F1 | High | historia | US-104 |
| 9 | US-109 | Definir número de porciones habituales | E1 | M02 | F1 | High | historia | US-104 |
| 10 | US-110 | Disponer de un catálogo inicial de recetas variado y compatible con cada dieta | E2 | M03 | F1 | High | historia | — |
| 11 | US-111 | Calcular la información nutricional de cada receta a partir de sus ingredientes | E4 | M03 | F1 | High | historia | US-110 |
| 15 | US-115 | Mostrar calorías y macros por porción en cada receta | E4 | M08 | F1 | High | historia | US-111 |
| 16 | US-116 | Editar perfil en cualquier momento | E1 | M02 | F1 | High | historia | US-106, US-107 |
| 17 | US-117 | Generar plan de comidas semanal automático | E2 | M04 | F1 | High | historia | US-110, US-107, US-103 |
| 18 | US-118 | Escalar porciones de una receta con recálculo automático | E2 | M03 | F1 | High | historia | US-110 |
| 19 | US-119 | Gestionar ingredientes de la despensa (agregar, editar, eliminar) | E3 | M06 | F1 | High | historia | US-104 |
| 20 | US-120 | Estimar costos con precios promedio reales de mi región | E3 | M07 | F1 | High | historia | US-112, US-110 |
| 21 | US-121 | Revisar con un nutricionista titulado las recetas y reglas nutricionales | E4 | M03 | F1 | High | historia | US-110 |
| 23 | US-123 | Marcar una comida como cocinada | E2 | M04 | F1 | High | historia | US-117, US-119 |
| 24 | US-124 | Generar lista de compras desde el plan semanal | E3 | M06 | F1 | High | historia | US-117 |
| 25 | US-125 | Excluir de la lista los ingredientes ya en despensa | E3 | M06 | F1 | High | historia | US-124, US-119 |
| 26 | US-126 | Marcar, eliminar y agregar ítems manualmente en la lista | E3 | M06 | F1 | High | historia | — |
| 27 | US-127 | Mostrar costo estimado del plan semanal | E3 | M07 | F1 | High | historia | US-120, US-117 |
| 28 | US-128 | Calificar una receta después de cocinarla | E4 | M08 | F1 | High | historia | US-123 |
| 29 | US-129 | Cambiar una comida del plan por una alternativa | E2 | M04 | F1 | High | historia | US-117 |
| 32 | US-132 | Alertar cuando el plan supera el presupuesto | E3 | M07 | F1 | High | historia | US-127, US-108 |
| 33 | US-133 | Exportar o eliminar todos mis datos | E5 | M01 | F1 | High | historia | US-104 |
| 34 | US-134 | Usar calificaciones para ajustar futuras recomendaciones | E4 | M08 | F1 | High | historia | US-128 |
| 58 | US-158 | Descargar la app desde la tienda oficial de mi teléfono | E6 | M11 | F1 | High | enabler | US-113, US-102 |
| 22 | US-122 | Detectar y corregir fallas de la app rápidamente | E6 | M11 | F2 | Medium | enabler | — |
| 30 | US-130 | Omitir onboarding y completarlo después | E1 | M02 | F2 | Medium | historia | — |
| 31 | US-131 | Medir el uso de las funciones clave para priorizar con datos | E6 | M11 | F2 | Medium | enabler | — |
| 35 | US-135 | Organizar lista de compras por sección del supermercado | E3 | M06 | F2 | Medium | historia | US-124 |
| 36 | US-136 | Ajustar objetivo de macronutrientes (slider de proteína) | E1 | M02 | F2 | Medium | historia | — |
| 37 | US-137 | Fijar tiempo máximo de cocina | E1 | M02 | F2 | Medium | historia | — |
| 38 | US-138 | Seleccionar cocinas favoritas | E1 | M02 | F2 | Medium | historia | — |
| 39 | US-139 | Generar plan solo para hoy | E2 | M04 | F2 | Medium | historia | — |
| 40 | US-140 | Usar la app con baja visión o lector de pantalla | E6 | M11 | F2 | Medium | enabler | — |
| 41 | US-141 | Ver gasto acumulado mensual vs. presupuesto | E3 | M07 | F2 | Medium | historia | — |
| 42 | US-142 | Registrar fecha de vencimiento de ingredientes | E3 | M06 | F2 | Medium | historia | US-119 |
| 43 | US-143 | Mostrar micronutrientes clave (sodio, azúcar, fibra) | E4 | M08 | F2 | Medium | historia | US-111 |
| 44 | US-144 | Dejar comentario corto sobre una receta | E4 | M08 | F2 | Medium | historia | — |
| 45 | US-145 | Activar modo «priorizar despensa» | E1 | M02 | F2 | Medium | historia | US-119, US-117 |
| 46 | US-146 | Evitar repetir proteína principal en días consecutivos | E2 | M04 | F2 | Medium | historia | US-117 |
| 47 | US-147 | Sugerir sustitutos de ingredientes según restricciones | E2 | M03 | F2 | Medium | historia | US-110 |
| 48 | US-148 | Recordatorio de la próxima comida | E2 | M09 | F2 | Medium | historia | US-117, US-123 |
| 49 | US-149 | Configurar frecuencia de notificaciones | E2 | M09 | F2 | Medium | historia | — |
| 50 | US-150 | Abrir y navegar la app con rapidez | E6 | M11 | F2 | Medium | enabler | — |
| 51 | US-151 | Reportar un problema o enviar sugerencias desde la app | E4 | M08 | F2 | Medium | historia | — |
| 52 | US-152 | Sugerir reemplazos para ajustar el plan al presupuesto | E3 | M07 | F2 | Medium | historia | US-132 |
| 53 | US-153 | Notificar ingredientes por vencer con recetas sugeridas | E3 | M06 | F2 | Medium | historia | US-142, US-148 |
| 55 | US-155 | Mostrar motivo de cada receta sugerida | E2 | M04 | F2 | Medium | historia | US-117 |
| 56 | US-156 | Manejar ingredientes no lineales al escalar porciones | E2 | M03 | F2 | Medium | historia | — |
| 57 | US-157 | Cambiar una comida mediante el asistente conversacional | E2 | M05 | F2 | Medium | historia | US-129 |
| 59 | US-159 | Resumen nutricional diario vs. objetivos | E4 | M08 | F2 | Medium | historia | US-123, US-115 |
| 60 | US-160 | Armar comida solo con ingredientes de la despensa (asistente) | E2 | M05 | F2 | Medium | historia | US-119, US-157 |
| 54 | US-154 | Solicitar consentimiento explícito para funciones de comunidad | E5 | M10 | F3 | Medium | historia | — |
| 61 | US-161 | Compartir lista de compras con otra persona | E3 | M06 | F3 | Low | historia | US-124 |
| 62 | US-162 | Sugerir recetas de aprovechamiento de sobras | E3 | M06 | F3 | Low | historia | — |
| 63 | US-163 | Reconocer ingredientes desde una foto | E3 | M12 | F3 | Low | historia | US-119 |
| 64 | US-164 | Escanear recibo de compra con OCR | E3 | M12 | F3 | Low | historia | US-119, US-141 |
| 65 | US-165 | Mostrar precios actualizados según supermercado elegido | E3 | M12 | F3 | Low | historia | US-120 |
| 66 | US-166 | Enviar lista de compras como pedido al supermercado | E3 | M12 | F3 | Low | historia | US-165, US-124 |
| 67 | US-167 | Publicar receta propia o adaptación | E5 | M10 | F3 | Low | historia | US-104, US-154 |
| 68 | US-168 | Comentar y dejar tips en recetas de la comunidad | E5 | M10 | F3 | Low | historia | US-167 |
| 69 | US-169 | Moderar contenido publicado por usuarios | E5 | M10 | F3 | Low | historia | US-167 |
| 70 | US-170 | Activar modo batch cooking | E1 | M02 | F3 | Low | historia | — |
| 71 | US-171 | Definir nivel de picante preferido | E1 | M02 | F3 | Low | historia | — |
| 72 | US-172 | Ofrecer «versión rápida» de una receta | E2 | M03 | F3 | Low | historia | — |
| 73 | US-173 | Respuestas rápidas en el chat del asistente | E2 | M05 | F3 | Low | historia | — |
