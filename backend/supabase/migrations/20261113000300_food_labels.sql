-- B3 (ADR-027): clasificación de alimentos escritos libremente ("queso campesino", "bolsas", "empanada").
-- La Edge Function categorize-food decide con este orden: caché → catálogo → Gemini → reglas.
-- Aquí vive la CACHÉ compartida de lo que clasificó la IA: el mismo texto normalizado no se vuelve a
-- preguntar (ahorra cuota y da siempre la misma respuesta). No guarda nada de la persona: solo el texto
-- del alimento y su clasificación, que es igual para todos.

-- Registro de uso de IA (cuota diaria por persona).
alter type public.ai_kind add value if not exists 'label';

create table public.food_labels (
  -- Texto normalizado: minúsculas, sin tildes ni signos, espacios simples ("Queso  Campesino!" → "queso campesino").
  key                    text primary key check (key ~ '^[a-z0-9]([a-z0-9 ]{0,78}[a-z0-9])?$' and char_length(key) >= 2),
  name                   text not null check (char_length(name) between 1 and 80),
  is_food                boolean not null,
  food_group_id          smallint references public.food_groups (id),
  store_category_id      smallint not null references public.ingredient_categories (id),
  -- Momento del día en que suele comerse (para antojos); nulo si no aplica.
  meal_slot              public.meal_slot,
  -- Estimación de la IA por porción típica; nula si no es comida. Solo informa, nunca se usa para alergias.
  kcal_per_serving       numeric(6, 1) check (kcal_per_serving between 0 and 3000),
  protein_g_per_serving  numeric(5, 1) check (protein_g_per_serving between 0 and 300),
  source                 text not null default 'ai' check (source in ('ai', 'manual')),
  model                  text,
  created_at             timestamptz not null default now(),
  -- Comida: lleva grupo. No comida (bolsas, jabón): sin grupo ni nutrición.
  check (case when is_food then food_group_id is not null
              else food_group_id is null and kcal_per_serving is null and protein_g_per_serving is null end)
);

comment on table public.food_labels is
  'Caché compartida de la clasificación de textos libres (B3, ADR-027). Solo la escribe la Edge Function categorize-food (service_role). Sin datos personales. Lo que deduce la IA es informativo: no se usa para filtrar alergias.';

alter table public.food_labels enable row level security;
create policy food_labels_read on public.food_labels for select to authenticated using (true);
revoke all on public.food_labels from anon, authenticated;
grant select on public.food_labels to authenticated;
