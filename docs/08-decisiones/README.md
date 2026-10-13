# Decisiones de arquitectura (ADR)

Estado: **Aceptada** = ya implementada o decidida con el usuario; **Propuesta** = elección razonable de la IA/arquitecta que el equipo puede cambiar. Para cambiar una decisión: nuevo ADR que reemplace, nunca editar en silencio.

| ADR | Decisión | Estado |
|---|---|---|
| [001](ADR-001.md) | Expo (React Native) + TypeScript estricto | Aceptada |
| [002](ADR-002.md) | Supabase como backend único | Aceptada |
| [003](ADR-003.md) | El LLM propone, la BD dispone | Aceptada |
| [004](ADR-004.md) | LLM solo desde Edge Functions con salida estructurada | Aceptada |
| [005](ADR-005.md) | Modelo de datos 3FN, derivar en vez de almacenar | Aceptada |
| [006](ADR-006.md) | Cantidades canónicas en gramos y escalado con exponente | Aceptada |
| [007](ADR-007.md) | RLS en todas las tablas; helpers en esquema `private` | Aceptada |
| [008](ADR-008.md) | Sin cifrado por campo en el MVP | Propuesta (pendiente de validar con abogado/auditor) |
| [009](ADR-009.md) | Consentimientos versionados con hash | Aceptada |
| [010](ADR-010.md) | Solo mayores de 18; `birth_year` en vez de fecha | Aceptada |
| [011](ADR-011.md) | Autorización separada de datos sensibles (facultativa y revocable) | Aceptada |
| [012](ADR-012.md) | Expo Router, TanStack Query (+persist), Zustand mínimo, RHF + Zod | Propuesta |
| [013](ADR-013.md) | Jest + RNTL + Maestro + pruebas SQL | Propuesta |
| [014](ADR-014.md) | Offline MVP = caché de lectura + cola de casillas de compras | Aceptada |
| [015](ADR-015.md) | Analítica propia anónima (`analytics_events`) | Aceptada |
| [016](ADR-016.md) | Tres entornos y despliegue con GitHub Actions + EAS + `supabase db push` | Aceptada |
| [017](ADR-017.md) | Moderación en Supabase Studio durante el MVP | Aceptada |
| [018](ADR-018.md) | El plan se arma con reglas; el LLM no está en el camino crítico | Aceptada |
| [019](ADR-019.md) | Límite de intentos de login con Supabase + CAPTCHA | Aceptada |
| [020](ADR-020.md) | Recetas versátiles: base + grupos intercambiables resueltos con la despensa | Aceptada |
| [021](ADR-021.md) | Revisión nutricional asistida por IA durante el piloto | Aceptada (piloto) |
