-- ADR-032: Política de Tratamiento de Datos, versión 2 (14-nov-2026). Agrega el análisis de fotos de la nevera o del
-- recibo con IA (la foto no se guarda) y las recetas creadas por el asistente (ADR-029). Es un cambio sustancial de
-- finalidades: quien aceptó la versión 1 la vuelve a aceptar en la app (pantalla "Documentos actualizados";
-- get_pending_consents compara con la última versión). El texto vive en backend/supabase/legal/01_….md.
insert into public.legal_documents (kind, version) values ('privacy_policy', 2);
