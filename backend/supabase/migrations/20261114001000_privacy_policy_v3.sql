-- ADR-037 y ADR-038: Política de Tratamiento de Datos, versión 3 (14-nov-2026). El asistente usa las preferencias
-- de la persona y una lista de ingredientes a evitar (alergias, dietas y gustos mezclados, sin el porqué), y se puede
-- dictar con el micrófono (el reconocimiento de voz del teléfono; NutriPlan no graba ni guarda la voz). Cambio de
-- finalidades e información a terceros: quien aceptó una versión anterior la vuelve a aceptar en la app (pantalla
-- "Documentos actualizados"; get_pending_consents compara con la última versión). El texto vive en
-- backend/supabase/legal/01_politica_tratamiento_datos.md.
insert into public.legal_documents (kind, version) values ('privacy_policy', 3);
