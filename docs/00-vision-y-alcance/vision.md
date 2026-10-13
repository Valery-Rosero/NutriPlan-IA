# Visión y alcance

## Visión
Que cada persona deje de improvisar qué cocinar: un plan semanal que **respeta su salud, sus gustos y su bolsillo**, con recetas reales, lista de compras que descuenta la despensa y un asistente que explica y ajusta, sin jamás poner en riesgo a quien tiene una alergia.

## Principios de producto
1. **Seguridad antes que ingenio:** alergias/dietas = filtros duros deterministas.
2. **La IA propone, la base de datos dispone.** Todo lo que sugiere el modelo se valida contra el catálogo real.
3. **Personalizable de verdad:** presupuesto, tiempo, macros, cocinas, picante, despensa, batch cooking.
4. **Útil con lo que hay:** priorizar despensa e ingredientes por vencer; reducir desperdicio.
5. **Honestidad:** precios estimados marcados; no es consejo médico.
6. **Privacidad por diseño:** consentimiento explícito para datos sensibles, revocable; exportar y borrar.

## Usuarios
| Persona | Necesidad | Notas |
|---|---|---|
| Usuario/a adulto/a general (principal) | Plan semanal rápido, compras, ahorro | 18+; Colombia; móvil |
| Con restricciones (alergia, vegetariano/a, condiciones) | Seguridad y variedad | Usa datos sensibles con autorización |
| Cocinero/a ocupado/a | Menos de 30 min, batch cooking | Tiempo máximo |
| Presupuesto ajustado | Controlar el gasto semanal | Precios estimados SIPSA/DANE |
| Contribuyente de comunidad | Publicar y calificar recetas | Moderación |
| Equipo de operación | Moderar, soporte | Solo Supabase Studio en MVP |

## Alcance
- **F0 Fundaciones y validación (8):** validar prototipo con usuarios (101), CI/CD y entornos (102), spikes de motor de recomendación (103) y de fuentes de precios (112), cuenta e inicio de sesión (104), protección de datos de salud en reposo/tránsito (105), política de privacidad (113), aviso de que no reemplaza consejo médico (114).
- **F1 MVP (24):** onboarding (dieta, alergias, presupuesto, porciones), catálogo inicial y revisión nutricional (110, 121), nutrición por porción (111, 115), editar perfil, plan semanal automático, escalado, despensa, costos y presupuesto (120, 127, 132), marcar cocinado, lista de compras (124–126), cambiar comida, calificar y ajustar recomendaciones (128, 134), exportar/eliminar datos (133), publicación en tiendas (158).
- **F2 Mejora y retención (27):** monitoreo de fallas, omitir onboarding, analítica, lista por sección, macros/tiempo/cocinas, plan de hoy, accesibilidad, gasto mensual, vencimientos, micronutrientes, comentarios, modo despensa, variedad de proteínas, sustitutos, notificaciones, reportes de soporte, motivo de cada sugerencia, escalado no lineal, asistente (157), resumen nutricional diario, comida con lo de la despensa.
- **F3 Después (14):** consentimiento para funciones futuras, compartir lista, sobras, foto/OCR, precios por supermercado, pedidos, comunidad (publicar, comentar, moderar), batch cooking, picante, versión rápida, respuestas rápidas del asistente.
(Detalle exacto: `05-historias-de-usuario/indice.md`.)

## Fuera de alcance (MVP)
Menores de edad y perfiles infantiles; hogares/listas compartidas; sobras (leftovers); variantes de receta; pedidos/compra en supermercado y precios por tienda; OCR/foto de nevera; panel de administración propio; pagos/suscripciones; iOS/Android nativo fuera de Expo; otros países/monedas; recomendaciones médicas o planes terapéuticos; registro con redes sociales. Ver `01-producto/limitaciones.md`.

## Métricas de éxito (objetivos a validar en piloto)
Activación (plan generado en el primer uso), planes completados/semana, % de comidas cocinadas, retención S4, ahorro frente al presupuesto, incidentes de alérgenos = **0** (bloqueante), costo de IA por usuario/mes (spike US-103). Se miden con `analytics_events` anónimos.
