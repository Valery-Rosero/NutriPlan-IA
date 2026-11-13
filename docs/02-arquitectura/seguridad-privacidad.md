# Seguridad y privacidad

## Controles implementados en BD
- RLS en las 64 tablas; `grants` mínimos; helpers en esquema `private`; vistas `security_invoker`. Las funciones `SECURITY DEFINER` (`export_my_data`, `register_push_device`, `unregister_push_device`, `report_app_error`) filtran por `auth.uid()` de forma explícita.
- Triggers `private.require_sensitive_authorization` en `profile_health`, `user_conditions`, `user_allergens`, `user_diets`, y `private.require_sensitive_for_targets` en las metas de proteína y calorías de `profiles`: sin autorización vigente no se escribe. Al revocarla, las metas se borran (`purge_targets_on_revoke`).
- `profiles.adult_declared_at` inmutable; sin fecha de nacimiento (`birth_year`).
- `user_consents` con `accepted_at/revoked_at` y `legal_documents.content_sha256` (evidencia del texto aceptado).
- `private.legal_readiness()` indica si los documentos legales están listos para producción.
- Registro de fallas (`app_errors`, ADR-026): el trigger `private.scrub_app_error` reemplaza correos, tokens JWT, UUID y números largos aunque la app no lo haya hecho; límite de 30 fallas por dispositivo y 1000 en total por hora. Solo el equipo las lee (service_role).
- Capturas de soporte en un bucket **privado**: cada persona sube y lee solo su carpeta.
- Analítica anónima (`analytics_events`, sin `user_id`) bloqueada por RLS si la persona la desactiva (`profiles.analytics_enabled`).

## Controles en la app y las Edge Functions
- Claves: solo la `anon` en la app; `service_role`, la clave de Gemini, la de Resend y los secretos compartidos (`PUSH_SECRET`, alertas) en los secretos de Edge Functions. Nunca en el repositorio.
- `google-services.json` (Firebase) y la llave de la cuenta de servicio de FCM **no van al repositorio** (`.gitignore`): el primero es una variable secreta de tipo archivo en EAS (`GOOGLE_SERVICES_JSON`), la segunda vive en `eas credentials`. Ver `07-plan-de-construccion/publicacion-android.md`.
- Fallas: `app/src/core/errors/scrub.ts` limpia el texto antes de enviarlo (primera capa) y agrupa repetidas; nunca se envían alergias, condiciones, medidas ni el contenido de formularios.
- Logs de Edge Functions: IDs y códigos, no contenido; nunca prompts con datos de salud.
- Prompts al LLM (ADR-025): solo el mensaje de la persona y las recetas candidatas ya filtradas por SQL (título, tiempo, qué ingredientes tiene en la despensa y cuáles le faltan); sin nombre, correo, alergias ni metas. La elegibilidad se valida en la BD.
- Cuota del asistente: 30 mensajes por día por persona; clasificación de alimentos: 100 por día (medidas en `ai_generations`).
- Clasificación de alimentos (ADR-027): la IA solo escoge de listas cerradas de la base y se valida; su resultado **no se usa para filtrar alergias**. La caché `food_labels` no tiene datos personales y solo la escribe la función.
- Entrada del asistente tratada como no confiable (inyección de prompts): salida estructurada (`responseSchema`), sin ejecutar texto libre; acciones solo vía `apply_assistant_suggestion`.
- Avisos push: el permiso se pide solo cuando la persona activa los avisos; el texto nombra la comida o el ingrediente, nunca datos de salud. El token se borra al cerrar sesión.
- Sesión guardada con `expo-secure-store`; enlaces de correo con PKCE.
- Revocación de la autorización de datos sensibles: UI para revocar (`revoke_consent`) y ofrecer borrar datos sensibles.
- Derechos del titular: acceso/portabilidad (`export_my_data`), actualización (editar perfil), supresión (`delete-account`), revocar autorización.

## Encargados de datos (proveedores)
| Proveedor | Para qué | Qué recibe |
|---|---|---|
| Supabase (São Paulo, Brasil) | Base de datos, Auth, Storage, Edge Functions | Todos los datos de la cuenta |
| Google: Gemini API | Asistente y clasificación de alimentos (ADR-027) | Mensaje de la persona, recetas candidatas y lo que falta de su despensa; el texto de un alimento escrito a mano ("queso campesino"). Sin identidad ni datos de salud |
| Google: Gmail (SMTP) | Correos de verificación y recuperación | Correo electrónico |
| Google: Firebase Cloud Messaging | Entrega de avisos en Android | Token del dispositivo y texto del aviso |
| Expo (EAS, Expo Push) | Compilación y envío de avisos | Token del dispositivo y texto del aviso |
| Resend | Correo de alerta de fallas **al equipo** | Resumen de fallas ya limpiado |

## Pendientes humanos
Evaluación de impacto de privacidad (IA + salud), revisión legal, RNBD si aplica, contratos de transmisión con los proveedores de la tabla, permiso ICBF. Antes de usuarios reales: plan de pago de Gemini (el gratuito puede usar los datos para mejorar sus modelos).
