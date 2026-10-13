-- Nuevo tipo de documento: autorización expresa para el tratamiento de datos sensibles
-- (Ley 1581 de 2012, art. 5, 6 y 12). Va en su propia migración porque un valor de enum
-- recién agregado no se puede usar dentro de la misma transacción.
alter type public.legal_doc_kind add value if not exists 'sensitive_data_authorization';
