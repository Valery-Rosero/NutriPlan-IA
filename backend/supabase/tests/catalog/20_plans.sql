-- ===================== Catálogo real: planes semanales y presupuesto =====================
-- Usa los perfiles creados en 10_catalog.sql (libre, vegana y con alergias).
do $$
declare
  u uuid;
  v_plan uuid;
  r record;
begin
  foreach u in array array['a0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-00000000000b',
                           'c0000000-0000-4000-8000-00000000000c']::uuid[] loop
    perform tt.login(u);
    v_plan := public.generate_plan(current_date, 7);
    perform tt.ok((select count(*) from public.planned_meals where plan_id = v_plan) = 21,
                  format('plan completo de 21 comidas para el perfil %s', left(u::text, 1)));
    perform tt.ok((select count(distinct recipe_id) from public.planned_meals where plan_id = v_plan and slot = 'lunch') >= 2,
                  'hay variedad en los almuerzos de la semana');
    perform tt.reset();
  end loop;

  update public.profiles set region_id = (select id from public.regions where code = 'CO-NAR-PASTO')
  where id = 'a0000000-0000-4000-8000-00000000000a';
  perform tt.login('a0000000-0000-4000-8000-00000000000a');
  select * into r from public.plan_budget_status((select id from public.meal_plans where status = 'draft' limit 1));
  perform tt.ok(r.currency_code = 'COP' and r.missing_prices > 0,
                'el presupuesto dice cuántos precios faltan en vez de inventarlos');
  perform tt.reset();
end $$;
