# Convenciones de código (cambios → ADR)

## Repositorio (monorepo) — ver ADR-022
```
/app                         Expo SDK 57 (Expo Router)
  src/app/                   rutas de UNA línea que reexportan pantallas: (auth) (tabs) consents legal/[kind] …
  src/features/<feature>/
    domain/                  tipos, puertos (interfaces *Repository), reglas puras, esquemas Zod
    data/                    adaptadores Supabase (implementan los puertos, traducen errores)
    application/             casos de uso (hooks TanStack Query), fábricas de claves
    ui/                      pantallas y componentes de la feature
    **/__tests__/
  src/core/                  AppError, formato (sin dependencias)
  src/infrastructure/        cliente Supabase, i18n/es-CO.json, caché, logger, env
  src/shared/{ui,theme}/     sistema de diseño accesible y paleta
  src/di/                    contenedor de servicios + raíz de composición
  src/test/fakes.tsx         dobles de repositorios para pruebas
  src/types/database.ts      generado: npx supabase gen types typescript --local
/backend/supabase            migraciones, seed, tests (run_local.sh), functions/<nombre>/index.ts
/.github/workflows           ci.yml, deploy-staging.yml
```
## Reglas
- TypeScript `strict`, sin `any`; ESLint (`npx expo lint`); imports absolutos `@/…`.
- **Dirección de dependencias:** `ui → application → domain ← data`. `domain/` no importa React, Supabase ni `infrastructure/`. Las pantallas nunca importan `infrastructure/supabase`; obtienen repositorios con `useServices()`.
- Una feature nueva = puerto en `domain/` + adaptador en `data/` + registro en `di/create-services.ts` + doble en `src/test/fakes.tsx`.
- Claves de query desde una fábrica por feature (`legalKeys`, `cookingKeys`): `[feature, entidad, params]`.
- Validar formularios con **Zod** (mensajes = claves i18n) y React Hook Form (`FormTextField`, `FormCheckbox`). Respuestas de Edge Functions también con Zod.
- Tipos de BD siempre generados; nunca escritos a mano. Regenerar tras cada migración.
- Errores: los adaptadores lanzan `AppError` con un `ErrorCode`; la UI muestra `t(errorKey(error))`. **Nunca** el texto crudo.
- Sin `console.log` de datos de usuario; usar `logger` (redacta campos sensibles).
- Mutaciones con actualización optimista solo en casillas de compras y favoritos; el resto espera al servidor.
- Textos legales: fuente única en `backend/supabase/legal/`; `npm run legal:drafts` los empaqueta en la app.
- Edge Functions: una carpeta por función, `index.ts` + `schema.ts` (Zod) + pruebas con `deno test`.
- Nombres: archivos `kebab-case`, componentes `PascalCase`, SQL `snake_case`, migraciones `AAAAMMDDhhmmss_descripcion.sql`.
- Commits convencionales; un PR por historia, título `US-123: …`.
- Pruebas: cada criterio Dado/Cuando/Entonces → una prueba (Jest/RNTL para UI con dobles inyectados, SQL para reglas, Maestro para flujos críticos).
- i18n: claves jerárquicas `feature.pantalla.elemento`; es-CO único idioma, estructura lista para más.
