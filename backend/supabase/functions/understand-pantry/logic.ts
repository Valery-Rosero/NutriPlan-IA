// Lógica pura de understand-pantry (ADR-030): prompt, validación de lo que dice la IA y reglas de respaldo.
// Convierte un texto libre ("2 libras de papa criolla, 6 huevos y un queso campesino") en varias cosas para la
// cocina. La IA solo PROPONE: la persona revisa la lista antes de guardar, y add_to_pantry valida al guardar.
import { z } from 'npm:zod@4';

export const MAX_TEXT = 300;
export const MAX_ITEMS = 10;
export const UNITS = ['g', 'kg', 'lb', 'unit', 'ml', 'l'] as const;
export type UnitCode = (typeof UNITS)[number];

/** Ingrediente del catálogo, con las unidades en que se puede guardar (contables del ingrediente + masa). */
export type CatalogIngredient = { id: string; name: string; shelf_life_days: number | null; units: string[] };

export type ParsedItem = {
  ingredient_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  /** Unidades válidas para guardarlo (catálogo: las del ingrediente; propio: las de un alimento propio). */
  units: string[];
  expires_in_days: number | null;
};

/** Toda cantidad de un ingrediente del catálogo se puede guardar en masa. */
export const MASS = ['g', 'lb', 'kg'];

export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          ref: { type: 'STRING', nullable: true, description: 'Referencia exacta I… si es un ingrediente de la lista; null si no.' },
          name: { type: 'STRING', description: 'Nombre corto del alimento, en español.' },
          quantity: { type: 'NUMBER' },
          unit: { type: 'STRING', enum: [...UNITS] },
          expires_in_days: { type: 'INTEGER', nullable: true, description: 'Días aproximados hasta que se dañe, o null si no se sabe.' },
        },
        required: ['name', 'quantity', 'unit'],
      },
    },
  },
  required: ['items'],
};

const itemSchema = z.object({
  ref: z.string().nullable().optional(),
  name: z.string().trim().min(1).max(80),
  quantity: z.number().positive().max(100000),
  unit: z.enum(UNITS),
  expires_in_days: z.number().int().min(0).max(365).nullable().optional(),
});
const answerSchema = z.object({ items: z.array(z.unknown()).max(30) });

/** Sin tildes, minúsculas y solo letras y números ("Fríjol" → "frijol"). */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9.,]+/g, ' ').trim();
}

export function systemPrompt(catalog: CatalogIngredient[]): string {
  return [
    'Conviertes lo que una persona de Pasto, Colombia, escribe sobre lo que compró o tiene en su cocina en una lista de alimentos.',
    `Separa cada alimento (máximo ${MAX_ITEMS}). Para cada uno da nombre, cantidad, unidad (${UNITS.join(', ')}) y días aproximados hasta que se dañe.`,
    'Si el alimento es uno de esta lista, usa su referencia EXACTA I… (aunque esté escrito distinto, en plural o con errores):',
    catalog.map((c, i) => `I${i + 1} ${c.name}`).join('\n'),
    'Si no está en la lista, ref = null y escribe su nombre bien escrito ("queso crema", "galletas").',
    'Unidades: "libra" = lb, "kilo" = kg, "gramos" = g, "litro" = l, "un/una/media docena/6" de algo contable = unit.',
    'Si no dice cantidad, usa 1 unit. No inventes alimentos que no estén en el texto. Ignora lo que no sea comida.',
  ].join('\n');
}

const unitsFor = (ingredient: CatalogIngredient | null) => (ingredient ? ingredient.units : [...UNITS]);

/** Valida lo que dijo la IA. Lo inválido se descarta; null si nada sirve (se usan las reglas). */
export function validateItems(raw: unknown, catalog: CatalogIngredient[]): ParsedItem[] | null {
  const parsed = answerSchema.safeParse(raw);
  if (!parsed.success) return null;
  const out: ParsedItem[] = [];
  for (const candidate of parsed.data.items) {
    const item = itemSchema.safeParse(candidate);
    if (!item.success) continue;
    const { ref, name, quantity, unit, expires_in_days } = item.data;
    const ingredient = ref ? catalog[Number(ref.replace(/^I/i, '')) - 1] ?? null : null;
    if (ref && !ingredient) continue; // referencia inventada
    out.push(toItem(ingredient, ingredient ? ingredient.name : capitalize(name), quantity, unit, expires_in_days ?? null));
    if (out.length === MAX_ITEMS) break;
  }
  return out.length ? merge(out) : null;
}

function toItem(ingredient: CatalogIngredient | null, name: string, quantity: number, unit: string, expires: number | null): ParsedItem {
  const units = unitsFor(ingredient);
  // Si la unidad no sirve para ese ingrediente (p. ej. "litros" de papa), queda la primera válida para revisar.
  return {
    ingredient_id: ingredient?.id ?? null,
    name,
    quantity: Math.round(quantity * 100) / 100,
    unit: units.includes(unit) ? unit : units[0],
    units,
    expires_in_days: expires ?? ingredient?.shelf_life_days ?? null,
  };
}

/** Lo mismo dos veces ("papa" y "papas") se suma si tiene la misma unidad. */
function merge(items: ParsedItem[]): ParsedItem[] {
  const out: ParsedItem[] = [];
  for (const item of items) {
    const same = out.find((o) => (o.ingredient_id ?? o.name) === (item.ingredient_id ?? item.name) && o.unit === item.unit);
    if (same) same.quantity += item.quantity;
    else out.push({ ...item });
  }
  return out;
}

// ------------------------------------------------------------------ reglas de respaldo (sin IA)
const NUMBERS: Record<string, number> = {
  un: 1, una: 1, uno: 1, media: 0.5, medio: 0.5, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8,
  nueve: 9, diez: 10, docena: 12,
};
const UNIT_WORDS: [RegExp, UnitCode][] = [
  [/^(kg|kgs|kilo|kilos|kilogramo|kilogramos)$/, 'kg'],
  [/^(g|gr|grs|gramo|gramos)$/, 'g'],
  [/^(lb|lbs|libra|libras)$/, 'lb'],
  [/^(ml|mililitro|mililitros)$/, 'ml'],
  [/^(l|lt|litro|litros)$/, 'l'],
  [/^(unidad|unidades|und|unds)$/, 'unit'],
];

/** "2 libras de papa criolla, 6 huevos y queso" → partes con cantidad, unidad y nombre; busca en el catálogo. */
export function rulesParse(text: string, catalog: CatalogIngredient[]): ParsedItem[] {
  const chunks = normalize(text.slice(0, MAX_TEXT))
    .split(/\s*(?:,|;|\n|\sy\s|\se\s)\s*/)
    .map((c) => c.trim())
    .filter(Boolean);
  const items: ParsedItem[] = [];
  for (const chunk of chunks.slice(0, MAX_ITEMS)) {
    let words = chunk.split(' ');
    let quantity = 1;
    let unit: string = 'unit';
    const n = Number(words[0]?.replace(',', '.'));
    if (!Number.isNaN(n) && n > 0) {
      quantity = n;
      words = words.slice(1);
    } else if (words[0] && NUMBERS[words[0]] !== undefined) {
      quantity = NUMBERS[words[0]];
      words = words.slice(1);
      if (words[0] === 'docena') {
        quantity *= 12;
        words = words.slice(1);
      }
    }
    const u = UNIT_WORDS.find(([re]) => re.test(words[0] ?? ''));
    if (u) {
      unit = u[1];
      words = words.slice(1);
    }
    if (words[0] === 'de') words = words.slice(1);
    const name = words.join(' ').trim();
    if (name.length < 2) continue;
    const ingredient = match(name, catalog);
    items.push(toItem(ingredient, ingredient ? ingredient.name : capitalize(name), quantity, unit, null));
  }
  return merge(items);
}

/** El ingrediente del catálogo que corresponde al nombre: exacto, luego por palabras (plural incluido). */
export function match(name: string, catalog: CatalogIngredient[]): CatalogIngredient | null {
  const target = singular(normalize(name));
  const scored = catalog
    .map((c) => {
      const cand = singular(normalize(c.name));
      if (cand === target) return { c, score: 3 };
      if (cand.startsWith(`${target} `) || target.startsWith(`${cand} `)) return { c, score: 2 };
      if (` ${cand} `.includes(` ${target} `)) return { c, score: 1 };
      return { c, score: 0 };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.name.length - b.c.name.length);
  return scored[0]?.c ?? null;
}

/** Plural español a singular: "limones" → "limon", "frijoles" → "frijol", "tomates" → "tomate", "papas" → "papa". */
const singular = (text: string) =>
  text
    .split(' ')
    .map((w) => {
      if (w.length <= 3) return w;
      if (/[lnrdzj]es$/.test(w)) return w.slice(0, -2);
      return w.endsWith('s') ? w.slice(0, -1) : w;
    })
    .join(' ');

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
