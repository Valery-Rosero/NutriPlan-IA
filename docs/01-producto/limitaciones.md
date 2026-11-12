# Limitaciones y brechas conocidas

Léelo antes de implementar. "BRECHA" = la historia lo pide pero **el esquema/funciones actuales no lo soportan**; hace falta migración nueva + ADR antes de construirlo. No lo simules en el cliente.

## A. Brechas de esquema / backend
| Brecha | Historias | Qué falta | Mitigación MVP |
|---|---|---|---|
| Variantes de receta ("versión rápida") | US-172 | Tabla `recipe_variants` y reglas de derivación | Publicar como receta distinta |
| Hogares y listas compartidas | US-161 | `households`, miembros, RLS por hogar | Cuenta individual |
| Sobras (leftovers) | US-162 | Modelo de porciones sobrantes y su consumo | Batch cooking simple |
| Producto→ingrediente y presentaciones de empaque | US-163, US-164 | `products`, `package_sizes`, mapeo | Fuera de MVP |
| Precios por tienda | US-165 | `store_prices` | Solo precio regional estimado |
| Pedidos a supermercado | US-166 | Integración externa + `orders` | Fuera de MVP |
| Panel de moderación/administración | M10 | UI propia | Supabase Studio + SQL; rol `moderator` |
| Nombres públicos de autores | M10 | Perfil público | Mostrar "Comunidad" / alias si se agrega |
| Perfiles infantiles | — | Prohibido por diseño (18+) | No se construye |
| Tiempos de cocción escalados | US-156 | Solo cantidades escalan (`scaling_exponent`); tiempos fijos | Mostrar tiempo base |

(El estado exacto de cada historia está en el campo "Reglas, límites y notas" de su ficha. Resuelta: nutrición diaria agregada, US-159, con la RPC `daily_nutrition` en la migración `20261111000200`.)

## B. Limitaciones técnicas
- **Offline:** solo caché de lectura (TanStack Query persistido) + cola de sincronización de casillas de la lista de compras. La app abre sin conexión con lo guardado (US-150). Generar plan, asistente, cocinar y publicar requieren conexión.
- **Bloqueo por intentos de inicio de sesión (US-104):** Supabase Auth no ofrece "5 intentos → 15 min" configurable tal cual; usar sus límites de tasa y, si no alcanzan, contador en Edge Function.
- **LLM:** solo lo usa el asistente (Gemini Flash-Lite, ~2 s); el plan se arma con reglas en SQL y no depende de él (ADR-018, ADR-023). Si Gemini falla o tarda, el asistente responde con un respaldo determinista. Cuota de 30 mensajes/día por persona. El plan gratuito de Gemini tiene límites de uso y puede usar los datos para mejorar sus modelos: pasar al plan de pago antes de usuarios reales (ADR-025).
- **Cifrado a nivel de campo:** no implementado (ADR-008): cifrado en reposo/TLS + RLS; reevaluar al alcanzar volumen/regulación.
- **Precios:** SIPSA son mayoristas → "estimado"; cobertura parcial de ingredientes (`missing_prices`).
- **Datos nutricionales:** USDA FoodData Central (CC0) y TCAC del ICBF (pendiente permiso). Los valores son referenciales.
- **Búsqueda:** `search_ingredients` es por texto/trigrama; sin búsqueda semántica.
- **Idiomas/regiones:** solo es-CO, COP, una región piloto.
- **Plataformas:** solo Android (APK con EAS; Google Play después). Sin iOS, web ni tablet optimizada en el piloto.
- **Avisos push:** no funcionan en Expo Go; hay que probarlos en el APK instalado.
- **Registro de fallas propio (ADR-026):** sin agrupación avanzada ni *source maps*; la pila llega minificada en el APK.
- **Pruebas:** 344 comprobaciones SQL sobre Supabase local (Docker) y en CI; recorrido de integración contra Supabase real; la base de staging recibe las mismas migraciones por GitHub Actions. Las pruebas en un teléfono real (tiempo de arranque, TalkBack, letra al 200 %) son manuales.

## C. Limitaciones de producto / legales
- Solo adultos (18+); la declaración queda inmutable en `profiles.adult_declared_at`.
- No es consejo médico ni dietético profesional; mostrar el aviso de salud y exigir aceptación (`health_disclaimer`).
- Datos sensibles (salud, alergias, condiciones, dietas) solo con `sensitive_data_authorization` vigente; si se revoca, se bloquea nuevo ingreso y se ofrece borrar lo existente.
- Transferencia internacional (Supabase en Brasil; Google, Expo y Resend en EE. UU.; ver la tabla de encargados en `02-arquitectura/seguridad-privacidad.md`): autorización expresa + contratos de transmisión; **pendiente de revisión legal**.
- Textos legales son **borradores**; no publicar hasta que `private.legal_readiness()` indique listo y un abogado colombiano los revise.
- Posible obligación RNBD (verificar umbral en UVT) y evaluación de impacto de privacidad (Circ. SIC 002/2024).
- ICBF TCAC: sin licencia declarada; pedir permiso escrito antes de redistribuir.
