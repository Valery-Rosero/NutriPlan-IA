"""Genera modelo-de-datos.md leyendo la base real (Supabase local con todas las migraciones aplicadas).

Uso, con `npx supabase start` corriendo en backend/:
    python docs/03-datos/_generar_modelo.py
Otra base: definir NUTRIPLAN_PSQL, p. ej. "psql -h localhost -p 54322 -U postgres -d postgres".
Si se crea o borra una tabla, el script se detiene y pide clasificarla en `domains`.
"""
import collections
import os
import pathlib
import shlex
import subprocess

PSQL = shlex.split(os.environ.get("NUTRIPLAN_PSQL", "docker exec -i supabase_db_backend psql -U postgres -d postgres"))
PSQL += ["-At", "-F", "\t", "-c"]


def q(sql):
    out = subprocess.run(PSQL + [sql], capture_output=True, text=True, encoding="utf-8", check=True).stdout
    return [l.rstrip("\r").split("\t") for l in out.splitlines() if l.strip()]


domains = collections.OrderedDict([
    ("Referencia (catálogos cerrados)", "countries regions food_groups ingredient_categories allergens diets diet_excluded_food_groups diet_excluded_allergens cuisines protein_sources units medical_conditions recommendation_reasons rating_tags legal_documents price_sources".split()),
    ("Identidad, privacidad y operación", "profiles profile_health user_roles user_consents notification_preferences push_devices app_errors".split()),
    ("Catálogo y recetas", "ingredients ingredient_unit_weights ingredient_nutrition ingredient_allergens ingredient_substitutions ingredient_prices recipes recipe_meal_slots recipe_ingredients recipe_flex_groups recipe_flex_options recipe_steps recipe_diet_tags nutritionist_reviews".split()),
    ("Preferencias del usuario", "user_diets user_allergens user_conditions user_disliked_ingredients user_cuisines favorite_recipes user_section_order".split()),
    ("Despensa, planes y compras", "pantry_items meal_plans planned_meals planned_meal_choices meal_pantry_deductions shopping_lists shopping_list_items shopping_list_substitutions purchases purchase_items".split()),
    ("Comunidad, asistente y soporte", "recipe_ratings recipe_rating_tag_links recipe_comments content_reports support_tickets assistant_conversations assistant_messages ai_generations notifications analytics_events".split()),
])

cols = q("""select c.table_name,c.column_name,
  format_type(a.atttypid,a.atttypmod), c.is_nullable, coalesce(c.column_default,''), coalesce(col_description(a.attrelid,a.attnum),''), c.ordinal_position, coalesce(c.generation_expression,'')
  from information_schema.columns c
  join pg_class k on k.relname=c.table_name and k.relnamespace='public'::regnamespace
  join pg_attribute a on a.attrelid=k.oid and a.attname=c.column_name
  where c.table_schema='public' order by c.table_name,c.ordinal_position""")
tcom = dict((r[0], r[1] if len(r) > 1 else "") for r in q("select c.relname, coalesce(obj_description(c.oid),'') from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r'"))
cons = q("""select conrelid::regclass::text, contype, pg_get_constraintdef(oid) from pg_constraint where connamespace='public'::regnamespace and contype in ('p','f','u','c','x') order by 1,2""")

real = set(tcom)
declared = [t for tabs in domains.values() for t in tabs]
faltan, sobran = real - set(declared), set(declared) - real
assert not faltan and not sobran, f"Clasifica en `domains`: faltan {sorted(faltan)}; ya no existen {sorted(sobran)}"
migs = int(q("select count(*) from supabase_migrations.schema_migrations")[0][0])

by = collections.defaultdict(list)
for r in cols:
    r += [""] * (8 - len(r))
    by[r[0]].append(r)
cby = collections.defaultdict(list)
for t, ty, d in cons:
    cby[t.replace("public.", "")].append((ty, d))

out = ["# Modelo de datos (generado desde las migraciones)\n",
       f"> Fuente de verdad: `backend/supabase/migrations/`. Este archivo se generó leyendo la base real después de aplicar las {migs} migraciones ({len(real)} tablas, todas con RLS). Si cambia una migración, regenerar: `python docs/03-datos/_generar_modelo.py` (con Supabase local encendido).\n",
       "Principios: 3FN; lo derivable no se guarda (alérgenos y dietas de una receta, nutrición por porción, picante y apto-batch); cantidades canónicas en gramos; RLS en todas las tablas; ver `reglas-de-negocio.md`.\n"]
for dom, tabs in domains.items():
    out.append(f"\n## {dom}\n")
    for t in tabs:
        out.append(f"\n### `{t}`\n")
        if tcom.get(t):
            out.append(tcom[t] + "\n")
        out.append("| Columna | Tipo | Nulo | Default / generada | Nota |\n|---|---|---|---|---|")
        for r in by[t]:
            d = r[4] or (("generada: " + r[7]) if r[7] else "")
            out.append(f"| `{r[1]}` | {r[2]} | {'sí' if r[3] == 'YES' else 'no'} | {d.replace('|', '\\|')} | {r[5].replace('|', '\\|')} |")
        ks = [f"- **{ {'p': 'PK', 'f': 'FK', 'u': 'UNIQUE', 'c': 'CHECK', 'x': 'EXCLUDE'}[ty]}**: `{d}`" for ty, d in cby.get(t, [])]
        if ks:
            out.append("\nRestricciones:\n" + "\n".join(ks))

out.append("\n## Vistas\n")
vc = {r[0]: (r[1] if len(r) > 1 else "") for r in q("select c.relname, coalesce(obj_description(c.oid),'') from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='v'")}
for (v,) in q("select table_name from information_schema.views where table_schema='public' order by 1"):
    out.append(f"- `{v}`: {vc.get(v) or 'ver migración'}")
out.append("\n## Enums\n")
for e, vals in q("select t.typname, string_agg(e.enumlabel, ', ' order by e.enumsortorder) from pg_type t join pg_enum e on e.enumtypid=t.oid where t.typnamespace='public'::regnamespace group by 1 order by 1"):
    out.append(f"- `{e}`: {vals}")

pathlib.Path(__file__).with_name("modelo-de-datos.md").write_text("\n".join(out) + "\n", encoding="utf-8", newline="\n")
print(len(real), "tablas,", migs, "migraciones,", len(out), "líneas")
