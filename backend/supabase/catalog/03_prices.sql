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
  ('Mazorca',  679, date '2026-07-08'),   -- maíz chócolo mazorca en El Potrerillo, boletín 08-jul-2026
  -- Informes por ciudad "Pasto, El Potrerillo" (bol-SIPSADiario-regionales-<fecha>.zip), primera calidad, ronda 1.
  -- $/kg = (mínimo + máximo) / 2 / kilos de la presentación (bulto, canastilla, caja…), redondeado.
  -- Solo equivalencias claras: NO se usan pollo entero (≠ pechuga o muslo), arveja en vaina (≠ desgranada)
  -- ni costilla de cerdo (≠ carne de cerdo). Lo que falta se sigue mostrando como "precio faltante".
  ('Papa',                     2754, date '2026-11-09'),   -- promedio ica-huila 2900, morasurco 2300, capira 3100, superior 3220, única 2250
  ('Papa criolla',             3600, date '2026-11-09'),   -- papa criolla limpia, bulto 50 kg $170.000–190.000
  ('Yuca',                     2083, date '2026-11-09'),   -- yuca ica, bulto 60 kg $120.000–130.000
  ('Plátano verde',            1667, date '2026-11-09'),   -- plátano hartón verde ecuatoriano, caja 30 kg $50.000
  ('Habichuela',               4167, date '2026-11-09'),   -- bulto 30 kg $120.000–130.000
  ('Ajo',                      9000, date '2026-11-09'),   -- atado 2 kg $18.000
  ('Pepino',                   2700, date '2026-11-09'),   -- pepino cohombro, bulto 50 kg $130.000–140.000
  ('Pimentón',                 4107, date '2026-11-09'),   -- caja 14 kg $55.000–60.000
  ('Zanahoria',                 900, date '2026-11-09'),   -- bulto 50 kg $45.000
  ('Cebolla cabezona',         1823, date '2026-11-09'),   -- cebolla cabezona blanca pastusa, bulto 48 kg $85.000–90.000
  ('Cebolla larga',             844, date '2026-11-09'),   -- cebolla junca pastusa, atado 22,5 kg $18.000–20.000
  ('Tomate',                   3125, date '2026-11-09'),   -- tomate larga vida, canastilla 20 kg $60.000–65.000
  ('Brócoli',                  1900, date '2026-11-09'),   -- kilogramo $1.800–2.000
  ('Cilantro',                 3800, date '2026-11-09'),   -- atado 5 kg $18.000–20.000
  ('Espinaca',                 2214, date '2026-11-09'),   -- atado 7 kg $15.000–16.000
  ('Repollo',                  1300, date '2026-11-09'),   -- repollo blanco, bulto 50 kg $60.000–70.000
  ('Limón',                    1929, date '2026-11-09'),   -- limón tahití, bulto 70 kg $130.000–140.000
  ('Fresa',                    9500, date '2026-11-09'),   -- kilogramo $9.000–10.000
  ('Mango',                    4300, date '2026-11-09'),   -- mango tommy, caja 25 kg $105.000–110.000
  ('Manzana',                  7632, date '2026-11-09'),   -- manzana royal gala importada, caja 19 kg $140.000–150.000
  ('Carne de res para sudar', 23000, date '2026-11-04'),   -- carne de res, morrillo, kilogramo $22.000–24.000
  ('Arroz blanco',             4422, date '2026-11-04'),   -- arroz blanco importado, bulto 45 kg $192.000–206.000
  ('Panela',                   3840, date '2026-11-04')    -- panela cuadrada morena, caja 25 kg $94.000–98.000
) v(ingredient, price, observed_on)
join public.ingredients i on i.name = v.ingredient
join public.regions r on r.code = 'CO-NAR-PASTO'
join public.price_sources s on s.name = 'DANE – SIPSA, precios mayoristas'
on conflict (ingredient_id, region_id, source_id, observed_on) do nothing;
