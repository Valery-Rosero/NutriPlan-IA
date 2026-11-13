-- ===================== US-174 · Cambios a toda la semana (migración 20261114000300, ADR-031) =====================
do $$
declare
  u uuid := '44444444-0000-0000-0000-000000000081';   -- alérgica al huevo
  v uuid := '44444444-0000-0000-0000-000000000082';
  v_meta jsonb := jsonb_build_object('privacy_policy_document_id', private.latest_legal_document('privacy_policy'),
                                     'terms_document_id', private.latest_legal_document('terms'), 'is_adult', true);
  v_plan uuid;
  v_plan2 uuid;
  v_ing uuid;
  v_cooked uuid;
  v_huevo uuid := (select id from public.ingredients where name = 'Huevo');
  v_egg_recipe uuid;
  r1 record;
  r2 record;
  v_n int;
begin
  insert into auth.users (id, email, raw_user_meta_data) values (u, 'semana-u@test.dev', v_meta), (v, 'semana-v@test.dev', v_meta);
  update public.profiles set region_id = (select id from public.regions where code = 'CO-NAR-PASTO') where id in (u, v);
  insert into public.user_consents (user_id, document_id) values (u, private.latest_legal_document('sensitive_data_authorization'));
  insert into public.user_allergens (user_id, allergen_id) select u, id from public.allergens where code = 'egg';
  perform tt.login(u);
  v_plan := public.generate_plan(current_date, 7, array['lunch', 'dinner']::public.meal_slot[]);

  -- S-5: lo cocinado no se toca. Se cocina la primera comida de hoy.
  select pm.id into v_cooked from public.planned_meals pm where pm.plan_id = v_plan order by pm.meal_date, pm.slot limit 1;
  perform public.mark_meal_cooked(v_cooked);

  -- S-1: "más barata" (con la otra persona, sin alergias: con los datos de prueba hay más recetas para comparar).
  perform tt.login(v);
  v_plan2 := public.generate_plan(current_date, 7, array['lunch', 'dinner']::public.meal_slot[]);
  perform tt.ok((select count(*) > 0 from public.propose_week_changes(v_plan2, 'cheaper', '{}', 93)),
                'propone cambios para abaratar la semana');
  perform tt.ok((select count(*) from public.propose_week_changes(v_plan2, 'cheaper', '{}', 93))
                = (select count(*) from public.plan_savings(v_plan2, 93)),
                'abarata con la misma lógica que los reemplazos de ahorro (US-152)');
  perform tt.ok((select bool_and(p.saving >= 500 and p.new_cost < p.current_cost and p.reason = 'cheaper')
                 from public.propose_week_changes(v_plan2, 'cheaper', '{}', 93) p),
                'cada cambio más barato ahorra al menos $500 y dice por qué');
  perform tt.ok(not exists (select 1 from public.planned_meals where plan_id = v_plan2 and replaced_recipe_id is not null),
                'proponer no cambia el plan');
  perform tt.login(u);

  -- S-2: evitar un ingrediente: ninguna comida pendiente queda con él.
  select l.ingredient_id into v_ing from public.planned_meals pm
  cross join lateral private.recipe_lines(pm.recipe_id, pm.servings, u, pm.id) l
  join public.ingredients i on i.id = l.ingredient_id
  where pm.plan_id = v_plan and pm.status = 'planned' and not i.is_staple and not l.is_optional
  group by l.ingredient_id order by count(*) desc, l.ingredient_id limit 1;
  perform tt.ok((select count(*) from public.propose_week_changes(v_plan, null, array[v_ing], 93))
                = (select count(*) from public.planned_meals pm
                   where pm.plan_id = v_plan and pm.status = 'planned' and not pm.is_extra and pm.meal_date >= current_date
                     and exists (select 1 from private.recipe_lines(pm.recipe_id, pm.servings, u, pm.id) l
                                 where l.ingredient_id = v_ing and not l.is_optional)),
                'toda comida pendiente con el ingrediente a evitar aparece (cambiada o avisada)');
  perform tt.ok(not exists (select 1 from public.propose_week_changes(v_plan, null, array[v_ing], 93) p
                            cross join lateral private.recipe_lines(p.new_recipe_id, 4, u, null) l
                            where p.new_recipe_id is not null and l.ingredient_id = v_ing and not l.is_optional),
                'ningún plato propuesto lleva lo que se pidió evitar');
  perform tt.ok((select bool_and(p.reason in ('avoid', 'avoid_unresolved') and ((p.reason = 'avoid_unresolved') = (p.new_recipe_id is null)))
                 from public.propose_week_changes(v_plan, null, array[v_ing], 93) p),
                'si no hay con qué cambiar una comida, lo dice en vez de callarlo');

  -- S-5 y S-4
  perform tt.ok(not exists (select 1 from public.propose_week_changes(v_plan, 'cheaper', array[v_ing], 93) where planned_meal_id = v_cooked)
                and not exists (select 1 from public.propose_week_changes(v_plan, 'faster', '{}', 93) where planned_meal_id = v_cooked),
                'una comida ya cocinada nunca aparece');
  perform tt.ok(not exists (select 1 from unnest(array['cheaper', 'faster', 'protein', 'variety', 'use_expiring']) g
                            cross join lateral public.propose_week_changes(v_plan, g, '{}', 93) p
                            cross join lateral private.recipe_lines(p.new_recipe_id, 4, u, null) l
                            where p.new_recipe_id is not null and l.ingredient_id = v_huevo),
                'ninguna meta propone algo con huevo a quien es alérgica');
  perform tt.ok((select coalesce(bool_and(p.new_minutes <= p.current_minutes - 10), true)
                 from public.propose_week_changes(v_plan, 'faster', '{}', 93) p),
                '"más rápida" ahorra al menos 10 minutos por comida');

  perform tt.throws(format($q$ select * from public.propose_week_changes(%L, 'magia') $q$, v_plan), 'invalid_goal', 'una meta inventada se rechaza');
  perform tt.throws(format($q$ select * from public.propose_week_changes(%L, null, '{}') $q$, v_plan), 'invalid_goal', 'sin meta ni nada que evitar no hay propuesta');

  -- S-3: aplicar solo lo marcado.
  select p.planned_meal_id, p.current_recipe_id, p.new_recipe_id into r1
  from public.propose_week_changes(v_plan, null, array[v_ing], 93) p where p.new_recipe_id is not null order by p.meal_date, p.slot limit 1;
  select p.planned_meal_id, p.new_recipe_id into r2
  from public.propose_week_changes(v_plan, null, array[v_ing], 93) p
  where p.new_recipe_id is not null and p.planned_meal_id <> r1.planned_meal_id order by p.meal_date, p.slot limit 1;
  v_n := public.apply_week_changes(v_plan, jsonb_build_array(jsonb_build_object('planned_meal_id', r1.planned_meal_id, 'recipe_id', r1.new_recipe_id)));
  perform tt.ok(v_n = 1 and (select recipe_id = r1.new_recipe_id and replaced_recipe_id = r1.current_recipe_id
                             from public.planned_meals where id = r1.planned_meal_id),
                'aplica el cambio marcado y recuerda la receta anterior');
  perform tt.ok((select recipe_id <> r2.new_recipe_id from public.planned_meals where id = r2.planned_meal_id),
                'lo desmarcado no cambia');

  v_egg_recipe := (select ri.recipe_id from public.recipe_ingredients ri where ri.ingredient_id = v_huevo limit 1);
  perform tt.throws(format($q$ select public.apply_week_changes(%L, %L::jsonb) $q$, v_plan,
                           jsonb_build_array(jsonb_build_object('planned_meal_id', r2.planned_meal_id, 'recipe_id', v_egg_recipe))),
                    'not_eligible', 'no se puede aplicar una receta con algo que la persona no puede comer');
  perform tt.throws(format($q$ select public.apply_week_changes(%L, %L::jsonb) $q$, v_plan,
                           jsonb_build_array(jsonb_build_object('planned_meal_id', v_cooked, 'recipe_id', r2.new_recipe_id))),
                    'meal_not_found', 'no se puede cambiar una comida ya cocinada');
  perform tt.throws(format($q$ select public.apply_week_changes(%L, %L::jsonb) $q$, v_plan,
                           jsonb_build_array(jsonb_build_object('planned_meal_id', r2.planned_meal_id, 'recipe_id', r2.new_recipe_id),
                                             jsonb_build_object('planned_meal_id', r2.planned_meal_id, 'recipe_id', r2.new_recipe_id))),
                    'invalid_changes', 'una comida no puede venir dos veces');

  -- Otra persona no puede ver ni cambiar este plan.
  perform tt.login(v);
  perform tt.throws(format($q$ select * from public.propose_week_changes(%L, 'cheaper') $q$, v_plan), 'plan_not_found',
                    'otra persona no puede pedir cambios a un plan ajeno');
  perform tt.throws(format($q$ select public.apply_week_changes(%L, %L::jsonb) $q$, v_plan,
                           jsonb_build_array(jsonb_build_object('planned_meal_id', r2.planned_meal_id, 'recipe_id', r2.new_recipe_id))),
                    'plan_not_found', 'ni aplicarlos');
  perform tt.reset();
  delete from auth.users where id in (u, v);
end $$;
