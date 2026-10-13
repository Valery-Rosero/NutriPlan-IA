# Checklist previo a producción

- [ ] Abogado colombiano revisó los 6 textos y completó los `[marcadores]` (responsable, contacto, canales, plazos).
- [ ] Textos cargados en `legal_documents`; `select private.legal_readiness();` indica listo.
- [ ] Registro: casillas 18+, términos y privacidad no premarcadas; aviso de privacidad visible.
- [ ] Autorización de datos sensibles: pantalla propia, facultativa, revocable; la app funciona (con límites) sin ella.
- [ ] Aviso de salud mostrado y aceptado; sin lenguaje de diagnóstico.
- [ ] Derechos del titular operativos: exportar (`export_my_data`), editar, eliminar (`delete-account`), revocar.
- [ ] Contratos de transmisión de datos con proveedores (Supabase, LLM, Sentry, Expo) y autorización de transferencia internacional.
- [ ] Evaluación de impacto de privacidad (Circ. SIC 002/2024: IA + salud).
- [ ] Verificar obligación de inscribir bases de datos en el RNBD (umbral en UVT; UVT 2026 = $52.374).
- [ ] Sin datos de salud en Sentry/logs/analytics (revisado con tráfico real).
- [ ] Permiso escrito del ICBF para TCAC; atribuciones de USDA (cita) y DANE ("Fuente: DANE…").
- [ ] Política de retención y borrado definida; backups cifrados.
- [ ] Fichas de tienda: política de privacidad, declaración de seguridad de datos (Play) y etiquetas de privacidad (App Store) coherentes con lo anterior.
