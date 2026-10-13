# Seguridad y privacidad

## Controles ya implementados en BD
- RLS en las 59 tablas; `grants` mínimos; helpers en esquema `private`; vistas `security_invoker`; `export_my_data` es `SECURITY DEFINER` con filtro explícito por `auth.uid()`.
- Triggers `private.require_sensitive_authorization` en `profile_health`, `user_conditions`, `user_allergens`, `user_diets`: sin autorización vigente no se escribe.
- `profiles.adult_declared_at` inmutable; sin fecha de nacimiento (`birth_year`).
- `user_consents` con `accepted_at/revoked_at` y `legal_documents.content_sha256` (evidencia del texto aceptado).
- `private.legal_readiness()` indica si los documentos legales están listos para producción.

## Controles que debe implementar la app / Edge Functions
- Claves: solo `anon` en la app; `service_role` y claves LLM en secretos de Edge Functions.
- Sentry: `beforeSend` elimina cuerpos de petición, emails y campos de salud; sin PII en breadcrumbs.
- Logs de Edge Functions: IDs, no contenido; nunca prompts con datos de salud en logs.
- Prompts al LLM: enviar **solo lo necesario** (restricciones como códigos, no texto libre ni identidad); sin nombre/correo.
- Rate limiting en `generate-plan`/`assistant-chat` (cuota diaria por usuario, medida en `ai_generations`).
- Entrada del asistente tratada como no confiable (inyección de prompts): salida estructurada, sin ejecutar texto libre; acciones solo vía `apply_assistant_suggestion`.
- Almacenamiento seguro del token de sesión (`expo-secure-store`).
- Revocación de la autorización de datos sensibles: UI para revocar (`revoke_consent`) y ofrecer borrar datos sensibles.
- Derechos del titular: acceso/portabilidad (`export_my_data`), actualización (editar perfil), supresión (`delete-account`), revocar autorización.

## Pendientes humanos
Evaluación de impacto de privacidad (IA + salud), revisión legal, RNBD si aplica, contratos de transmisión con proveedores, permiso ICBF.
