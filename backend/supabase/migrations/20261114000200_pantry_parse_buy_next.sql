-- ADR-030: (a) "Escríbelo como lo dirías": la Edge Function understand-pantry entiende un texto libre
-- ("2 libras de papa criolla y 6 huevos") con IA y lo convierte en varias cosas para la cocina; aquí solo se
-- registra su uso. (b) "Para completar más recetas": qué comprar para terminar recetas, calculado EXACTO por
-- la base (no por la IA) con lo que le falta a cada receta segura para la persona.

alter type public.ai_kind add value if not exists 'pantry';

-- Ingredientes que, comprados, completan recetas que hoy casi se pueden hacer (les faltan 1 o 2 cosas).
-- Mismo conjunto seguro que "¿Qué cocino?" (cook_with_what_i_have → eligible_recipes): alergias, dietas,
-- tiempo y lo que no le gusta ya están filtrados. Orden: cuántas recetas COMPLETA (solo le falta eso),
-- luego en cuántas ayuda.
create function public.what_to_buy_next(p_limit integer default 3)
returns table (ingredient_id uuid, name text, completes integer, helps integer, recipes text[])
language sql stable set search_path = '' as $$
  with near as (
    select c.recipe_id, c.title, c.missing_count, c.missing
    from public.cook_with_what_i_have(null, null, 50) c
    where c.missing_count between 1 and 2
  ),
  missing as (
    select n.recipe_id, n.title, n.missing_count, (x ->> 'ingredient_id')::uuid as ingredient_id, x ->> 'ingredient_name' as name
    from near n cross join lateral jsonb_array_elements(n.missing) x
  )
  select m.ingredient_id, m.name,
         count(*) filter (where m.missing_count = 1)::int as completes,
         count(*)::int as helps,
         (array_agg(m.title order by m.missing_count, m.title))[1:3] as recipes
  from missing m
  group by m.ingredient_id, m.name
  order by 3 desc, 4 desc, m.name
  limit least(greatest(coalesce(p_limit, 3), 1), 10)
$$;
revoke all on function public.what_to_buy_next(integer) from public, anon;
grant execute on function public.what_to_buy_next(integer) to authenticated;
