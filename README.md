# NutriPlan AI

App móvil (Android) para familias en Colombia que no saben qué cocinar: propone comidas **con lo que ya hay en casa**, arma el plan semanal y la lista de compras, controla el presupuesto y nunca pone en riesgo a quien tiene una alergia. Idioma: español (es-CO).

> Antes de escribir código, lee **`AGENTS.md`** (reglas obligatorias) y **`docs/07-plan-de-construccion/plan-de-arranque.md`** (estado y siguientes pasos).

## Estructura
| Carpeta | Qué contiene |
|---|---|
| `app/` | App Expo SDK 57 (Expo Router en `src/app/`, TypeScript estricto) |
| `backend/supabase/` | Migraciones, catálogo real (`catalog/`, es el seed), pruebas SQL (`tests/`, 230 verificaciones), borradores legales |
| `docs/` | Especificación completa: visión, producto, arquitectura, datos, módulos, 73 historias, legal, plan, ADR, referencias |
| `.github/workflows/` | CI: pruebas de base de datos y de la app |

## Requisitos
Node 20+, Docker Desktop abierto y Git. La CLI de Supabase se usa con `npx supabase`.

## Base de datos local
```bash
cd backend
npx supabase start                      # primera vez: descarga imágenes (varios minutos)
bash supabase/tests/run_local.sh        # reconstruye la base y corre todas las pruebas
```
Studio local: http://127.0.0.1:54323 · correos de prueba (Mailpit): http://127.0.0.1:54324

## App
```bash
cd app
cp .env.example .env                    # URL y anon key de staging (son públicas)
npx expo start                          # abre en Android con Expo Go o una development build
```

## Entornos (ADR-016)
| Entorno | Dónde | Proyecto |
|---|---|---|
| dev | Supabase local (Docker) | — |
| staging | Supabase, São Paulo | `fiesvxiuxsllqcpxidap` |
| prod | Supabase, São Paulo | `drgzvvkkjxqvolcerpjx` |

Ninguna tabla se crea a mano en el panel: todo entra por migraciones. Para subir migraciones **y el catálogo** a staging: `cd backend && npx supabase db push --include-seed --remote` (sin `--remote`, la CLI actual apunta a la base local). Los archivos de catálogo ya cargados no se vuelven a ejecutar: si cambian, se corren a mano en el SQL Editor (son idempotentes). La `service_role` key y las claves de terceros (Resend, LLM) nunca van en el repositorio.

## Estado (12-nov-2026)
- **Hecho · F0 + F1 (MVP):** base de datos con RLS y recetas versátiles, catálogo real, registro y consentimientos, onboarding y perfil, despensa, receta y "Cocinar ahora", plan semanal con presupuesto, lista de compras sin conexión, calificaciones, exportar y eliminar datos.
- **Hecho · F2:** rediseño completo (paleta, modo oscuro), tiempo máximo y cocinas favoritas, sustitutos, asistente con Gemini (ADR-025), ayuda y sugerencias, precios reales de Pasto (SIPSA), gasto del mes y reemplazos para ahorrar, Mi día y metas de nutrición, analítica anónima, accesibilidad (letra al 200 % y TalkBack), arranque sin conexión, registro de fallas con alerta (ADR-026), notificaciones (recordatorios, por vencer, resumen semanal).
- **Calidad:** 344 verificaciones SQL, 279 pruebas de la app, 15 de la lógica del asistente y 13 de integración contra Supabase real.
- **Staging al día** (migraciones, catálogo, funciones, secretos, SMTP de Gmail y plantillas en español). Producción (`drgzvvkkjxqvolcerpjx`) aún no.
- **Pendiente:** lista ordenada en `docs/07-plan-de-construccion/pendientes.md` (verificaciones del APK, calendario como libro, plan de mes, clasificación de alimentos con IA, antojos, y lo necesario antes de usuarios reales). Se avanza de a un ítem.
- **Para publicar:** ver `docs/07-plan-de-construccion/publicacion-android.md`.
