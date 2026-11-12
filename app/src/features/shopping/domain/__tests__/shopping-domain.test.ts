import { applyChecked, pendingToPantry, progress, splitClosed, toSections } from '@/features/shopping/domain/shopping';
import { SHOPPING } from '@/test/fakes';

describe('lista de compras (US-125, US-135)', () => {
  it('agrupa por sección en orden y deja al final lo que ya está en la despensa', () => {
    const sections = toSections(SHOPPING.items);
    expect(sections.map((s) => s.title ?? s.kind)).toEqual(['Verdulería y frutas', 'Lácteos y huevos', 'buy', 'have']);
    expect(sections.at(-1)?.data.map((i) => i.name)).toEqual(['Arroz blanco']);
  });

  it('el progreso no cuenta lo que ya se tiene', () => {
    expect(progress(SHOPPING.items)).toEqual({ done: 0, total: 3 });
  });

  it('marca una casilla sin tocar las demás', () => {
    const next = applyChecked(SHOPPING, 'i1', true);
    expect(next.items.find((i) => i.id === 'i1')?.checked).toBe(true);
    expect(next.items.filter((i) => i.checked)).toHaveLength(1);
    expect(SHOPPING.items.find((i) => i.id === 'i1')?.checked).toBe(false); // inmutable
  });

  it('solo pasa a la despensa lo marcado, del catálogo y aún no pasado', () => {
    let list = applyChecked(SHOPPING, 'i1', true);
    list = applyChecked(list, 'i4', true); // manual, sin ingrediente: no cuenta
    expect(pendingToPantry(list.items)).toBe(1);
  });

  it('lo que ya pasó a la despensa sale de la lista y se cuenta aparte', () => {
    const items = SHOPPING.items.map((i) => (i.id === 'i1' ? { ...i, checked: true, movedToPantry: true } : i));
    const { open, closed } = splitClosed(items);
    expect(closed).toBe(1);
    expect(open.find((i) => i.id === 'i1')).toBeUndefined();
    expect(progress(open)).toEqual({ done: 0, total: 2 });
  });
});
