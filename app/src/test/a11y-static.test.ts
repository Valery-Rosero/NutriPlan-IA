/// <reference types="node" />
/**
 * US-140: revisión estática de accesibilidad sobre TODO el código de la app (no solo las pantallas probadas).
 * El contraste AA lo verifica shared/theme/__tests__/contrast.test.ts; aquí, lo que se rompe al escribir pantallas.
 */
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..');

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e: fs.Dirent) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sources(full);
    return e.name.endsWith('.tsx') ? [full] : [];
  });
}

const files = sources(SRC).map((f) => ({ file: path.relative(SRC, f), text: fs.readFileSync(f, 'utf8') }));
const lineOf = (text: string, index: number) => text.slice(0, index).split('\n').length;

describe('accesibilidad (US-140)', () => {
  it('todo lo tocable, imágenes, campos e interruptores tienen etiqueta para el lector de pantalla', () => {
    const missing = files.flatMap(({ file, text }) =>
      [...text.matchAll(/<(Pressable|TouchableOpacity|Image|TextInput|Switch)\b([^>]*?)\/?>/gs)]
        .filter((m) => !m[2].includes('accessibilityLabel') && !m[2].includes('accessibilityElementsHidden'))
        .map((m) => `${file}:${lineOf(text, m.index!)} <${m[1]}>`),
    );
    expect(missing).toEqual([]);
  });

  it('nadie desactiva el texto escalable del sistema', () => {
    const off = files.filter(({ text }) => /allowFontScaling=\{false\}/.test(text)).map(({ file }) => file);
    expect(off).toEqual([]);
  });

  it('el texto no se corta a una línea (al 200 % se perdería información)', () => {
    const oneLine = files.flatMap(({ file, text }) =>
      [...text.matchAll(/numberOfLines=\{1\}/g)].map((m) => `${file}:${lineOf(text, m.index!)}`),
    );
    expect(oneLine).toEqual([]);
  });
});
