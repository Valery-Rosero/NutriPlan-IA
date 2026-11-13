# Legal y cumplimiento

**Aviso:** los textos son **borradores** (marcadores `[entre corchetes]`) y requieren revisión de un abogado colombiano antes de publicarse. No son asesoría legal.

## Contenido
- `borradores/` — 01 Política de tratamiento de datos · 02 Autorización de datos sensibles · 03 Términos y condiciones · 04 Aviso de salud · 05 Reglas de comunidad · 06 Aviso de privacidad en registro.
- `checklist-cumplimiento.md` — qué debe estar hecho antes de lanzar.
- `datos-y-licencias.md` — licencias de las fuentes de datos.

## Versiones publicadas
- Política de Tratamiento de Datos: **v2** (13-nov-2026, migración `20261114000400`): fotos de la nevera o del recibo (no se guardan) y recetas creadas por el asistente. Quien aceptó la v1 la vuelve a aceptar en la app. La fuente del texto es `backend/supabase/legal/`; `borradores/` es una copia que debe quedar igual.

## Cómo se implementa en la app
Cada texto se inserta en `legal_documents` (con `content_sha256`); la app lee la versión vigente, muestra y registra aceptación (`accept_consent`/`signUp`). Ver módulo M01 y `03-datos/reglas-de-negocio.md`.
