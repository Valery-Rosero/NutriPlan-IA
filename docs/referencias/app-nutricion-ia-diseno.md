# NutriPlan AI — Diseño de una app inteligente de planificación de comidas

## 1. Recolección de datos del usuario

El onboarding debe ser corto (2–3 minutos) pero suficientemente rico para personalizar bien. Estructura sugerida:

**Paso 1 — Perfil básico**
- Edad, sexo, peso/altura (opcional, para cálculo calórico)
- Nivel de actividad física
- Objetivo: perder peso, mantener, ganar músculo, comer más saludable, ahorrar tiempo

**Paso 2 — Preferencias y restricciones**
- Tipo de dieta: omnívoro, vegetariano, vegano, pescetariano, keto, paleo, mediterránea, etc.
- Restricciones médicas: celiaquía (sin gluten), intolerancia a la lactosa, diabetes, hipertensión (bajo sodio)
- Alergias (crítico marcarlas como "hard constraint", nunca sugerir ni por error): frutos secos, mariscos, huevo, soja, etc.
- Alimentos que no le gustan (soft constraint, se evitan pero no son peligrosos)

**Paso 3 — Contexto práctico**
- Presupuesto semanal/mensual para comida
- Número de personas en el hogar / raciones por comida
- Tiempo disponible para cocinar (ej. "máx 20 min entre semana")
- Equipamiento disponible (horno, air fryer, olla de presión)
- Ingredientes que ya tiene en casa (despensa)

**Diseño de UI para esto:** usar chips seleccionables en vez de formularios largos, con búsqueda predictiva para alergias/ingredientes. Guardar todo como un perfil editable en cualquier momento, no solo en el onboarding.

## 2. Generación de planes de comida personalizados

Arquitectura sugerida (modelo híbrido, no solo "preguntarle a un LLM"):

1. **Motor de filtrado por reglas** (rápido, determinista): descarta recetas que violen alergias, dieta o ingredientes prohibidos. Esto nunca debe depender solo de un LLM por razones de seguridad.
2. **Modelo de recomendación** (colaborativo + basado en contenido): rankea recetas candidatas según historial de calificaciones, similitud con comidas que le gustaron antes, y variedad (evitar repetir la misma proteína 4 días seguidos).
3. **LLM como capa de personalización final**: ajusta porciones, sugiere sustituciones, y genera el plan en lenguaje natural con explicaciones ("elegí esto porque ya tienes espinaca en la despensa").

**Frecuencia de planes:**
- Plan diario: 1 sugerencia rápida basada en lo que hay en la despensa + tiempo disponible ese día.
- Plan semanal: optimiza variedad nutricional, reutiliza ingredientes entre recetas (ej. si compras cilantro, usarlo en 2-3 recetas para que no se desperdicie) y reparte el presupuesto.

## 3. Cálculo de cantidades por porciones

Cada receta debe almacenarse con:
- Cantidad base por ingrediente para N porciones estándar (ej. 4)
- Un factor de escalado lineal: `cantidad_final = cantidad_base × (porciones_deseadas / porciones_base)`
- Excepciones marcadas para ingredientes no lineales (ej. especias, tiempos de cocción, tamaños de molde) que no escalan proporcionalmente y requieren reglas propias o redondeo a unidades prácticas ("2.3 huevos" → "2 huevos grandes")

## 4. Adaptación de recetas

- **Sustituciones automáticas**: mantener una tabla de equivalencias (mantequilla ↔ aceite de coco, leche ↔ leche de almendra) filtrada por la dieta del usuario.
- **Adaptación por ingredientes disponibles**: si al usuario le faltan 1-2 ingredientes no esenciales, sugerir la receta igual con una alternativa; si falta el ingrediente principal, no la recomienda.
- **Ajuste de dificultad/tiempo**: permitir "versión rápida" de una receta que combine pasos o use atajos (ej. salsa de tomate en lata en vez de tomates frescos triturados).

## 5. Lista de compras inteligente

- Se genera automáticamente a partir del plan semanal, consolidando ingredientes repetidos entre recetas.
- Se cruza contra el inventario de despensa declarado por el usuario para no comprar de más.
- Se organiza por secciones del supermercado (verdulería, lácteos, despensa, congelados) para hacer la compra más eficiente.
- Permite edición manual (tachar, agregar ítems personales como productos de limpieza).

## 6. Gestión de presupuesto

- Base de datos de precios promedio por ingrediente (actualizable regionalmente, ya que varía mucho por país/ciudad).
- Al generar el plan, se muestra un costo estimado total y por receta.
- Si se excede el presupuesto declarado, la app sugiere automáticamente:
  - Reemplazar una proteína cara por una más económica (ej. pollo → legumbres)
  - Reducir la cantidad de recetas "premium" y aumentar recetas con ingredientes de despensa
  - Comprar en presentaciones más grandes si el precio por unidad baja

## 7. Minimizar el desperdicio de comida

- Priorizar en el ranking de recomendación las recetas que usan ingredientes próximos a vencer (si el usuario los registra con fecha).
- Sugerir "recetas de aprovechamiento" cuando sobran ingredientes de otra receta (ej. sobró medio pimiento → sugerir salteado para el día siguiente).
- Notificaciones suaves: "tienes cilantro que vence en 2 días, aquí tienes 3 recetas que lo usan".

## 8. Mejoras futuras

- **Reconocimiento de alimentos por foto**: usar visión por computadora para identificar ingredientes en la nevera/despensa y agregarlos automáticamente al inventario.
- **Escaneo de recibos (OCR)**: extraer ítems comprados automáticamente para actualizar despensa y gasto real vs. presupuestado.
- **Integración con supermercados**: pedidos directos desde la lista de compras, y en el futuro, inventario en tiempo real para saber si un producto está disponible antes de planificar la receta.

## 9. Estrategias de engagement

- Notificaciones contextuales, no invasivas (recordatorio de comida del día, no spam).
- Gamificación ligera: rachas de "comidas caseras seguidas", insignias por probar cocinas nuevas.
- Modo conversacional: poder pedirle a la app "cámbiame la cena de hoy, no tengo ganas de pollo" y que regenere en segundos.

## 10. Ejemplos de restricciones dietéticas a soportar

Sin gluten, vegano, vegetariano, sin lactosa, keto, bajo en sodio (hipertensión), bajo índice glucémico (diabetes), sin frutos secos, sin mariscos, halal, kosher, sin huevo, baja en FODMAP.

## 11. Consideraciones de diseño de interfaz

- Onboarding corto, con opción de "completar después".
- Vista de plan semanal tipo calendario/tablero, con drag-and-drop para reordenar comidas.
- Modo "cocinar ahora" con pasos grandes y temporizadores integrados (pantalla legible con las manos sucias).
- Accesibilidad: buen contraste, texto escalable, soporte de lectura por voz de la receta.

## 12. Información nutricional

- Cada receta debe mostrar calorías, macronutrientes (proteína, carbohidratos, grasa) y idealmente micronutrientes clave (fibra, sodio, azúcar) por porción.
- Vista agregada semanal/diaria comparando contra los objetivos del usuario (ej. barra de progreso de proteína del día).

## 13. Mecanismos de feedback

- Calificación rápida (👍/👎 o estrellas) después de cada receta cocinada.
- Feedback específico opcional: "muy salado", "tardó más de lo esperado", "me encantó, repetir".
- Este feedback retroalimenta directamente el modelo de recomendación (paso 2 de la sección de generación de planes).

## 14. Funciones de comunidad

- Compartir recetas propias o adaptaciones de recetas de la app.
- Colecciones curadas por otros usuarios ("comidas para batch cooking", "cenas en 15 minutos").
- Comentarios y tips en recetas (ej. "yo le agrego comino y queda mejor").
- Moderación de contenido para evitar spam o consejos nutricionales peligrosos en comentarios.

## 15. Privacidad y seguridad de datos

- Los datos de salud (alergias, condiciones médicas, peso) son datos sensibles: deben cifrarse en tránsito y en reposo, y nunca compartirse con terceros sin consentimiento explícito.
- Minimización de datos: solo pedir lo estrictamente necesario para personalizar.
- Cumplimiento con regulaciones relevantes según el mercado (GDPR en Europa, leyes locales de protección de datos en Latinoamérica).
- Opción clara para que el usuario exporte o elimine todos sus datos.
- Dejar explícito que la app no reemplaza el consejo de un nutricionista o médico, especialmente para condiciones médicas (diabetes, hipertensión, etc.).

## 16. Posibles alianzas con supermercados

- APIs de inventario en tiempo real para mostrar disponibilidad y precio actualizado.
- Programas de cupones/descuentos integrados en la lista de compras.
- Pedidos con entrega a domicilio directamente desde la app.

## 17. Estrategias de marketing

- Content marketing: recetas y tips nutricionales en redes sociales que enlacen a la app.
- Partnerships con nutricionistas/influencers de fitness para validación y alcance.
- Freemium: funciones básicas gratis (plan semanal simple), funciones premium de pago (integración de presupuesto avanzado, reconocimiento por foto, coach nutricional con IA).
- Programa de referidos con beneficios para quien invita y quien se une.

---

**Nota:** este documento es una guía de producto/diseño técnico, no asesoría médica. Cualquier función relacionada con condiciones de salud específicas (diabetes, hipertensión, alergias severas) debería incluir advertencias claras de que la app es una herramienta de apoyo, no un reemplazo de un profesional de la salud.
