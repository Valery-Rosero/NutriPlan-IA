-- =============================================================================
-- Catálogo real · 03 · Precios de referencia (US-112, US-120)
-- SOLO datos verificables, con fuente y fecha. Son precios MAYORISTAS de SIPSA (DANE) en Pasto,
-- mercado El Potrerillo: la app los muestra siempre como "estimados". Nunca se inventan precios (AGENTS.md regla 8).
-- Para completar: tomar el anexo mensual "Precios mayoristas" de SIPSA (dane.gov.co › Operaciones › SIPSA),
-- agregar filas aquí (ingrediente, $/kg, fecha, boletín) y volver a correr el seed. Atribución obligatoria: "Fuente: DANE – SIPSA".
-- =============================================================================

insert into public.price_sources (name, url, license_notes)
values ('DANE – SIPSA, precios mayoristas', 'https://www.dane.gov.co/index.php/estadisticas-por-tema/agropecuario/sistema-de-informacion-de-precios-sipsa',
        'Fuente: DANE – SIPSA. Uso y transformación permitidos citando la fuente. Precios mayoristas: se muestran como estimados.')
on conflict (name) do nothing;

insert into public.ingredient_prices (ingredient_id, region_id, price_per_kg, source_id, observed_on)
select i.id, r.id, v.price, s.id, v.observed_on
from (values
  -- ingrediente, $/kg, fecha del boletín SIPSA diario (bol-SIPSADiario-<fecha>.pdf)
  ('Papa',    2100, date '2026-09-02'),   -- papa en El Potrerillo, boletín 02-sep-2026
  ('Tomate',  2875, date '2026-07-08'),   -- tomate en El Potrerillo, boletín 08-jul-2026
  ('Mazorca',  679, date '2026-07-08')    -- maíz chócolo mazorca en El Potrerillo, boletín 08-jul-2026
) v(ingredient, price, observed_on)
join public.ingredients i on i.name = v.ingredient
join public.regions r on r.code = 'CO-NAR-PASTO'
join public.price_sources s on s.name = 'DANE – SIPSA, precios mayoristas'
on conflict (ingredient_id, region_id, source_id, observed_on) do nothing;
