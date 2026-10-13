# Convenciones de código (propuestas; cambios → ADR)

## Repositorio sugerido (monorepo)
```
/app                 Expo (Expo Router)
  app/(auth) (onboarding) (tabs) …
  src/features/<modulo>/{api,hooks,components,schemas,__tests__}
  src/lib/{supabase.ts,queryClient.ts,i18n/es-CO.json,sentry.ts,format.ts}
  src/types/database.ts   ← generado: supabase gen types typescript
/backend/supabase    migraciones, seed, tests, functions/<nombre>/index.ts
/.github/workflows   ci.yml, deploy-staging.yml, deploy-prod.yml
```
## Reglas
- TypeScript `strict`, sin `any`; ESLint + Prettier; imports absolutos.
- Acceso a datos solo desde `features/*/api`; los componentes usan hooks de TanStack Query. Claves de query: `[modulo, entidad, params]`.
- Validar toda entrada de formularios y respuestas de Edge Functions con **Zod**.
- Tipos de BD siempre generados; nunca escritos a mano. Regenerar tras cada migración.
- Errores: los de RPC llevan `message` estable (`consent_required`, `adult_required`, `health_disclaimer_required`, …); mapearlos a textos i18n; **nunca** mostrar el texto crudo.
- Sin `console.log` de datos de usuario; un `logger` que descarta campos sensibles.
- Mutaciones con actualización optimista solo en casillas de compras y favoritos; el resto espera al servidor.
- Edge Functions: una carpeta por función, `index.ts` + `schema.ts` (Zod) + pruebas con `deno test`.
- Nombres: archivos `kebab-case`, componentes `PascalCase`, SQL `snake_case`, migraciones `AAAAMMDDhhmmss_descripcion.sql`.
- Commits convencionales; un PR por historia, título `US-123: …`.
- Pruebas: cada criterio Dado/Cuando/Entonces → una prueba (Jest/RNTL para UI, SQL para reglas, Maestro para flujos críticos: registro, onboarding, plan, compras, cocinar).
- i18n: claves jerárquicas `modulo.pantalla.elemento`; es-CO único idioma, estructura lista para más.
