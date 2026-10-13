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

Ninguna tabla se crea a mano en el panel: todo entra por migraciones. Para subir migraciones **y el catálogo** a staging: `cd backend && npx supabase db push --include-seed`. La `service_role` key y las claves de terceros (Resend, LLM) nunca van en el repositorio.

## Estado (13-oct-2026)
- **Hecho:** esquema completo con RLS en todas las tablas, refuerzos de seguridad, recetas versátiles (ADR-020), pruebas en verde sobre Supabase real, esqueleto de la app.
- **Siguiente:** Sprint 1 (registro, inicio de sesión y consentimientos) y catálogo de recetas versátiles.
