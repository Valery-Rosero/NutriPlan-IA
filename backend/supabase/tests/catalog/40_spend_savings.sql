-- ===================== Catálogo real: gasto del mes (US-141) y reemplazos para ahorrar (US-152) =====================
-- Perfil libre de 10_catalog.sql (región Pasto desde 20_plans.sql).
do $$
declare
  u uuid := 'a0000000-0000-4000-8000-00000000000a';
  v_plan uuid; v_list uuid; r record; s record; v_before numeric; v_after numeric; n int;
begin
  perform tt.login(u);

  -- US-141: registrar lo pagado y verlo frente al presupuesto
  v_plan := (select id from public.meal_plans where user_id = u and status = 'draft' order by created_at desc limit 1);
  v_list := public.generate_shopping_list(v_plan);
  perform public.record_purchase(30000, v_list, 'Potrerillo');
  perform public.record_purchase(8200);
  perform tt.throws($q$ select public.record_purchase(0) $q$, 'invalid_amount', 'US-141: no se registra una compra en cero');
  update public.profiles set budget_amount = 60000, budget_period = 'month' where id = u;
  select * into r from public.monthly_spend();
  perform tt.ok(r.spent = 38200 and r.purchases = 2 and r.monthly_budget = 60000 and r.percent = 64,
                format('US-141: 64%% — $38.200 de $60.000 (obtuvo %s%% de %s)', r.percent, r.monthly_budget));
  update public.profiles set budget_amount = 70000, budget_period = 'week' where id = u;
  select * into r from public.monthly_spend();
  perform tt.ok(r.monthly_budget = round(70000 * ((r.month_start + interval '1 month')::date - r.month_start) / 7.0),
                'US-141: un presupuesto semanal se lleva al mes (× días del mes ÷ 7)');
  perform tt.ok((select spent from public.monthly_spend(r.month_start - 1)) = 0, 'US-141: el mes anterior no suma lo de este mes');

  -- US-152: reemplazos más baratos, con ahorro exacto
  select count(*) into n from public.plan_savings(v_plan);
  perform tt.ok(n >= 2, format('US-152: propone al menos 2 reemplazos (propuso %s)', n));
  perform tt.ok(not exists (select 1 from public.plan_savings(v_plan) where saving < 500 or alternative_cost >= current_cost
                                                                       or saving <> current_cost - alternative_cost),
                'US-152: cada reemplazo ahorra de verdad y el ahorro es exacto');
  perform tt.ok(not exists (select 1 from public.plan_savings(v_plan) ps
                            where not exists (select 1 from public.eligible_recipes(ps.slot) e where e.id = ps.alternative_recipe_id)),
                'US-152: solo propone recetas elegibles para ese momento del día');
  perform tt.ok((select count(*) = count(distinct alternative_recipe_id) from public.plan_savings(v_plan)),
                'US-152: no propone la misma receta varias veces (no rompe la variedad)');

  -- aceptar uno recalcula el total
  select * into s from public.plan_savings(v_plan) limit 1;
  v_before := (select estimated_cost from public.plan_budget_status(v_plan));
  update public.planned_meals set recipe_id = s.alternative_recipe_id, replaced_recipe_id = s.current_recipe_id,
                                  reason_code = 'budget_friendly' where id = s.planned_meal_id;
  v_after := (select estimated_cost from public.plan_budget_status(v_plan));
  perform tt.ok(v_after < v_before, format('US-152: al aceptar, el total baja (%s → %s)', v_before, v_after));
  perform tt.reset();

  -- la lista de otra persona no se puede usar para registrar compras
  perform tt.login('b0000000-0000-4000-8000-00000000000b');
  perform tt.throws(format($q$ select public.record_purchase(1000, %L) $q$, v_list), 'list_not_found',
                    'US-141: no se registran compras sobre listas ajenas');
  perform tt.reset();
end $$;
