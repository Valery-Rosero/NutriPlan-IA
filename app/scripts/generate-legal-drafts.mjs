// Empaqueta los BORRADORES legales (backend/supabase/legal/*.md) dentro de la app.
// Una sola fuente de verdad: si cambia un texto, se vuelve a correr `npm run legal:drafts`.
// Cuando los textos aprobados se publiquen (legal_documents.content_url), la app usa la versión publicada.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const legalDir = join(here, '..', '..', 'backend', 'supabase', 'legal');
const out = join(here, '..', 'src', 'features', 'legal', 'data', 'legal-drafts.generated.ts');

const files = {
  privacy_policy: '01_politica_tratamiento_datos.md',
  sensitive_data_authorization: '02_autorizacion_datos_sensibles.md',
  terms: '03_terminos_condiciones.md',
  health_disclaimer: '04_aviso_salud.md',
  community_sharing: '05_reglas_comunidad.md',
};

// Las casillas "[ ] ..." del borrador las dibuja la app como controles reales.
const clean = (text) => text.replace(/\r\n/g, '\n').replace(/^\[ \].*$/gm, '').trim();

const drafts = Object.fromEntries(
  Object.entries(files).map(([kind, file]) => [kind, clean(readFileSync(join(legalDir, file), 'utf8'))]),
);
// En el registro solo va el cuerpo del aviso (sin título ni nota de borrador).
const registrationNotice = clean(readFileSync(join(legalDir, '06_aviso_privacidad_registro.md'), 'utf8'))
  .split(/\n/)
  .filter((line) => !line.startsWith('#') && !line.startsWith('>'))
  .join(String.fromCharCode(10))
  .trim();

writeFileSync(
  out,
  `// ARCHIVO GENERADO por scripts/generate-legal-drafts.mjs. No editar a mano.\n` +
    `import type { LegalDocKind } from '@/features/legal/domain/legal';\n\n` +
    `export const legalDrafts: Record<LegalDocKind, string> = ${JSON.stringify(drafts, null, 2)};\n\n` +
    `export const registrationNotice = ${JSON.stringify(registrationNotice)};\n`,
);
console.log(`Generado ${out}`);
