# Publicación en Android (US-158)

Solo Android. Las compilaciones se hacen en la nube con EAS: no hace falta Android Studio.

## 1. Antes de compilar (una vez)
1. Subir migraciones, catálogo y la función de borrado al proyecto que vaya a usar la compilación:
   ```bash
   cd backend
   npx supabase link --project-ref fiesvxiuxsllqcpxidap      # staging (para pruebas)
   npx supabase db push --remote --include-seed               # migraciones + catálogo de recetas y precios (CLI v3: --remote)
   npx supabase functions deploy delete-account               # US-133
   npx supabase functions deploy assistant-chat               # US-157 (Gemini)
   npx supabase functions deploy categorize-food              # B3: clasificación de alimentos (Gemini)
   npx supabase functions deploy understand-pantry            # ADR-030: "Escríbelo como lo dirías" (Gemini)
   npx supabase functions deploy send-notifications error-alert  # avisos y alertas de fallas
   ```
   Para producción, lo mismo con `--project-ref drgzvvkkjxqvolcerpjx`.
2. En el panel de Supabase de ese proyecto: SMTP (Gmail con contraseña de aplicación; o Resend con dominio verificado si más adelante hay dominio), plantillas en español de `backend/supabase/templates/`, *Site URL* `nutriplan://`, *Redirect URLs* `nutriplan://**` y `exp://**`, contraseña mínima 8 con mayúsculas, minúsculas y números.
3. Cuenta en [expo.dev](https://expo.dev) e iniciar sesión: `cd app && npx eas-cli@latest login`, luego `npx eas-cli@latest init` (vincula el proyecto).
4. Notificaciones (Firebase). `google-services.json` **no va al repositorio** (tiene una clave de Google; está en `.gitignore`). Se guarda en EAS como variable secreta de tipo archivo, una vez por ambiente (`preview` y `production`, según `eas.json › build.<perfil>.environment`):
   ```bash
   cd app
   npx eas-cli@latest env:set --environment preview --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret
   npx eas-cli@latest env:list --environment preview          # debe salir GOOGLE_SERVICES_JSON=*****
   ```
   `app/app.config.js` lee esa variable al compilar; en local usa `app/google-services.json`. La llave de la cuenta de servicio de FCM (`*firebase-adminsdk*.json`) va en `eas credentials` (Android › Push Notifications: FCM V1) y tampoco se sube al repositorio.

## 2. APK para probar con el equipo (staging)
```bash
cd app
npx eas-cli@latest build -p android --profile preview
```
EAS entrega un enlace para descargar el APK e instalarlo en cualquier Android (hay que permitir "orígenes desconocidos"). Usa los datos de **staging** (`eas.json › preview.env`).

## 3. Google Play (producción)
1. Cuenta de desarrollador de Google Play (pago único de USD 25).
2. Compilar el paquete de tienda (usa **producción**):
   ```bash
   npx eas-cli@latest build -p android --profile production
   ```
3. Crear la app en Play Console (`co.nutriplan.app`) y subir el `.aab`, o usar `npx eas-cli@latest submit -p android --profile production` (requiere una clave de servicio de Google Play). Queda como borrador en la pista **interna**.
4. Antes de abrir una prueba cerrada, completar en Play Console:
   - **Política de privacidad (URL pública):** publicar `backend/supabase/legal/01_politica_tratamiento_datos.md` revisada por un abogado, por ejemplo en GitHub Pages, y cargar su URL y hash en `legal_documents.content_url` / `content_sha256` (`private.legal_readiness()` debe quedar en verdadero).
   - **Seguridad de los datos:** se recogen correo (cuenta), alergias, dietas y datos de salud (opcional, con autorización), despensa y planes (funcionalidad de la app). No se comparten con terceros para publicidad. Se cifran en tránsito. La persona puede pedir su eliminación desde la app (Perfil › Privacidad › Eliminar mi cuenta).
   - **Clasificación de contenido** y **público objetivo: mayores de 18 años**.
   - **Declaración de salud:** la app no es un dispositivo médico; ver `04_aviso_salud.md`.

## 4. Checklist de salida (de `plan.md`)
- [ ] 0 incidentes de alérgenos en pruebas (prueba de contenido `tests/catalog/` en verde).
- [ ] Criterios de F1 en verde (CI).
- [ ] `select * from private.legal_readiness();` todo en verdadero (textos revisados por abogado).
- [ ] Evaluación de impacto de privacidad hecha (`06-legal-y-cumplimiento/checklist-cumplimiento.md`).
- [ ] Recetas validadas por un nutricionista titulado (ADR-021) antes de abrir al público.
