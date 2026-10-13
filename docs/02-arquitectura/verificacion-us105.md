# US-105 · Verificación de protección de datos de salud (reposo y tránsito)

Entregable de la historia según ADR-008 (sin cifrado por campo en el MVP). Fecha: 13-oct-2026.

| Control | Cómo se cumple | Evidencia | Estado |
|---|---|---|---|
| Cifrado en tránsito | La app solo habla con `https://<ref>.supabase.co` (TLS); Supabase no expone la API por HTTP plano | `app/src/infrastructure/env.ts` valida que la URL sea válida; URLs de staging y prod son `https` | Cumple |
| Cifrado en reposo (servidor) | Supabase cifra disco y backups (AES-256) en su infraestructura | Documentación de seguridad de Supabase; confirmar en el contrato de transmisión | Cumple (por confirmar en contrato) |
| Cifrado en reposo (teléfono) | La sesión se guarda cifrada con AES-256; la clave vive en el Keystore de Android (`expo-secure-store`) | `app/src/infrastructure/supabase/secure-storage.ts` | Cumple |
| Caché local sin datos sensibles | Solo se persisten consultas marcadas `meta.persist` (plan y lista de compras) | `app/src/infrastructure/query-client.ts` | Cumple |
| Aislamiento por usuario | RLS en todas las tablas; prueba que falla si una tabla nueva no lo tiene | `backend/supabase/tests/10_signup_rls.sql`, `80_flexible_recipes.sql` (198 verificaciones) | Cumple |
| Datos de salud separados | `profile_health` y `user_conditions` aparte; requieren autorización expresa | Migraciones 0003 y 0011 | Cumple |
| Sin datos de salud en logs | `logger` redacta campos sensibles y solo registra el código del error | `app/src/infrastructure/logger.ts` + prueba en `core.test.ts` | Cumple |
| Backups | El plan gratuito de Supabase no ofrece copias descargables ni recuperación a un punto en el tiempo | — | **Pendiente:** plan Pro antes de datos reales |

Revisar este documento si cambia el proveedor, el plan de Supabase o si un auditor exige cifrado por campo (ADR-008).
