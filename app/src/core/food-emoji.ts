/**
 * "Cocina viva": la comida se muestra con emojis (la interfaz, con íconos de línea). Mientras no haya fotos,
 * el emoji ocupa el lugar del plato o del ingrediente. Se elige por palabras del nombre, en español, sin
 * tildes; los platos van antes que los ingredientes ("Tortilla de papa" es 🍳, no 🥔). Puramente decorativo:
 * el nombre siempre se muestra al lado.
 */
const RULES: [RegExp, string][] = [
  // Platos
  [/\b(batido|jugo|limonada|malteada|smoothie)/, '🥤'],
  [/\b(changua|crema|avena|cereal|colada|mazamorra)/, '🥣'],
  [/\b(sopa|sancocho|caldo|sudado|guisad|ajiaco|cocido|estofado)/, '🍲'],
  [/\b(ensalada)/, '🥗'],
  [/\b(pasta|espagueti|macarron|lasana)/, '🍝'],
  [/\b(calentado|salteado|arroz con)/, '🍛'],
  [/\b(perico|tortilla|revuelto|omelet)/, '🍳'],
  [/\b(arepa|empanada)/, '🫓'],
  [/\b(patacon|platano|banano|tajada)/, '🍌'],
  [/\b(hamburguesa)/, '🍔'],
  [/\b(sandwich|sanduche)/, '🥪'],
  // Ingredientes
  [/\b(arroz)/, '🍚'],
  [/\b(frijol|lenteja|garbanzo)/, '🫘'],
  [/\b(arveja|habichuela)/, '🫛'],
  [/\b(huevo)/, '🥚'],
  [/\b(pollo|pechuga|muslo|gallina)/, '🍗'],
  [/\b(res|carne|cerdo|lomo|costilla|chorizo|salchicha)\b/, '🥩'],
  [/\b(atun|sardina|pescado|tilapia|trucha|mojarra)/, '🐟'],
  [/\b(queso|cuajada)/, '🧀'],
  [/\b(leche|yogur|kumis)/, '🥛'],
  [/\b(pan)\b/, '🍞'],
  [/\b(panela|azucar|miel)/, '🍯'],
  [/\b(harina|maiz|mazorca)/, '🌽'],
  [/\b(papa|yuca|arracacha|olluco)/, '🥔'],
  [/\b(ahuyama|calabaza|zapallo)/, '🎃'],
  [/\b(tomate)/, '🍅'],
  [/\b(cebolla)/, '🧅'],
  [/\b(ajo)\b/, '🧄'],
  [/\b(zanahoria)/, '🥕'],
  [/\b(brocoli|coliflor)/, '🥦'],
  [/\b(espinaca|repollo|lechuga|acelga|cilantro|perejil|cebollin)/, '🥬'],
  [/\b(pepino)/, '🥒'],
  [/\b(pimenton|aji)\b/, '🫑'],
  [/\b(champinon|hongo)/, '🍄'],
  [/\b(aguacate)/, '🥑'],
  [/\b(fresa|fruta)/, '🍓'],
  [/\b(mango)/, '🥭'],
  [/\b(manzana)/, '🍎'],
  [/\b(limon)/, '🍋'],
  [/\b(naranja|mandarina)/, '🍊'],
  [/\b(pina)\b/, '🍍'],
  [/\b(uvas?)\b/, '🍇'],
  [/\b(moras?|arandano)/, '🫐'],
  [/\b(aceite|aceituna)/, '🫒'],
  [/\b(sal|comino|pimienta|condimento|oregano|laurel)\b/, '🧂'],
  [/\b(agua)\b/, '💧'],
];

/** Sin tildes ni mayúsculas ("Fríjol" → "frijol", "Piña" → "pina"). */
function normalize(name: string) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Emoji de un plato o ingrediente por su nombre; `fallback` si ninguna palabra lo identifica. */
export function foodEmoji(name: string, fallback = '🍽️'): string {
  const text = normalize(name);
  return RULES.find(([re]) => re.test(text))?.[1] ?? fallback;
}
