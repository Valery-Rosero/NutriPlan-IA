-- ===================== Datos sensibles, revocatoria y minimización =====================
do $$
declare
  b uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  d uuid := 'dddddddd-0000-0000-0000-000000000004';
  v_sens smallint := private.latest_legal_document('sensitive_data_authorization');
  r jsonb; n int;
begin
  -- D no ha dado la autorización: no puede guardar alergias, dietas ni medidas
  perform tt.throws(format($q$ insert into public.user_allergens (user_id, allergen_id) select %L, id from public.allergens limit 1 $q$, d),
                    'sensitive_authorization_required', 'sin autorización no se guardan alergias');
  perform tt.throws(format($q$ insert into public.user_diets (user_id, diet_id) select %L, id from public.diets limit 1 $q$, d),
                    'sensitive_authorization_required', 'sin autorización no se guardan dietas');
  perform tt.throws(format($q$ insert into public.profile_health (user_id, height_cm) values (%L, 170) $q$, d),
                    'sensitive_authorization_required', 'sin autorización no se guardan datos de salud');
  perform tt.throws(format($q$ insert into public.profile_health (user_id, birth_year) values (%L, extract(year from current_date)::int - 10) $q$, d),
                    '', 'el año de nacimiento no puede corresponder a un menor');

  -- D acepta, guarda datos, revoca: todo se borra y no se vuelve a pedir
  perform tt.login(d);
  perform public.accept_consent(v_sens);
  insert into public.user_allergens (user_id, allergen_id) select d, id from public.allergens where code = 'peanuts';
  insert into public.profile_health (user_id, height_cm, birth_year) values (d, 165, 1990);
  perform tt.ok((select count(*) from public.user_allergens) = 1, 'con autorización se guardan alergias');
  r := public.revoke_consent('sensitive_data_authorization');
  perform tt.ok((r ->> 'user_allergens')::int = 1 and (r ->> 'profile_health')::int = 1, 'revocar informa qué datos se borraron');
  perform tt.ok((select count(*) from public.user_allergens) = 0 and (select count(*) from public.profile_health) = 0, 'revocar borra alergias y datos de salud');
  perform tt.ok((select revoked_at is not null from public.user_consents where document_id = v_sens), 'la revocatoria queda registrada (prueba)');
  perform tt.ok(not exists (select 1 from public.my_pending_consents where kind = 'sensitive_data_authorization'), 'lo revocado no se vuelve a pedir');
  perform tt.reset();
  perform tt.throws(format($q$ insert into public.user_allergens (user_id, allergen_id) select %L, id from public.allergens limit 1 $q$, d),
                    'sensitive_authorization_required', 'tras revocar no se pueden guardar datos sensibles');
  perform tt.login(d);
  perform tt.throws($q$ select public.revoke_consent('sensitive_data_authorization') $q$, 'consent_not_found', 'no se puede revocar dos veces');
  perform tt.throws($q$ select public.revoke_consent('privacy_policy') $q$, 'not_revocable', 'la política no se revoca (se elimina la cuenta)');
  perform public.accept_consent(v_sens);
  insert into public.user_allergens (user_id, allergen_id) select d, id from public.allergens where code = 'peanuts';
  perform tt.ok(true, 'volver a aceptar reactiva el permiso');
  perform tt.reset();

  -- revocar comunidad: se borran comentarios y se despublican recetas propias
  update public.user_consents set revoked_at = null where false;
  insert into public.user_consents (user_id, document_id) values (b, private.latest_legal_document('community_sharing')) on conflict do nothing;
  insert into public.recipe_comments (recipe_id, user_id, body) values ((select id from public.recipes limit 1), b, 'hola');
  perform tt.login(b);
  r := public.revoke_consent('community_sharing');
  perform tt.reset();
  perform tt.ok((r ->> 'comments')::int = 1 and not exists (select 1 from public.recipe_comments where user_id = b), 'revocar comunidad borra los comentarios');
  perform tt.throws(format($q$ insert into public.recipe_comments (recipe_id, user_id, body) values ((select id from public.recipes limit 1), %L, 'otra vez') $q$, b),
                    'consent_required', 'tras revocar no se puede comentar');
end $$;

-- ===================== Declaración de mayoría de edad inmutable =====================
do $$
declare a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
begin
  perform tt.login(a);
  perform tt.throws(format($q$ update public.profiles set adult_declared_at = null where id = %L $q$, a),
                    'adult_declaration_locked', 'la declaración de mayoría de edad no se puede borrar ni editar');
  perform tt.reset();
end $$;

-- ===================== Textos legales listos para publicar =====================
do $$
begin
  perform tt.ok((select count(*) from private.legal_readiness()) = 5, 'hay 5 documentos legales vigentes (incluida la autorización de datos sensibles)');
  perform tt.ok((select count(*) from private.legal_readiness() where not has_text) = 5, 'hoy ningún documento tiene texto: la lista de verificación de lanzamiento lo detecta');
  perform tt.throws($q$ update public.legal_documents set content_url = 'https://ejemplo.co/politica' where kind = 'terms' $q$,
                    'legal_documents_content_pair', 'un texto publicado exige su hash');
  update public.legal_documents set content_url = 'https://ejemplo.co/terminos', content_sha256 = repeat('a', 64) where kind = 'terms';
  perform tt.ok((select has_text from private.legal_readiness() where kind = 'terms'), 'con URL y hash el documento queda listo');
end $$;
