# Legal y cumplimiento

**Aviso:** los textos son **borradores** (marcadores `[entre corchetes]`) y requieren revisión de un abogado colombiano antes de publicarse. No son asesoría legal.

## Contenido
- `borradores/` — 01 Política de tratamiento de datos · 02 Autorización de datos sensibles · 03 Términos y condiciones · 04 Aviso de salud · 05 Reglas de comunidad · 06 Aviso de privacidad en registro.
- `checklist-cumplimiento.md` — qué debe estar hecho antes de lanzar.
- `datos-y-licencias.md` — licencias de las fuentes de datos.

## Cómo se implementa en la app
Cada texto se inserta en `legal_documents` (con `content_sha256`); la app lee la versión vigente, muestra y registra aceptación (`accept_consent`/`signUp`). Ver módulo M01 y `03-datos/reglas-de-negocio.md`.
