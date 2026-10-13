import { latestByKind, requiredConsents, type LegalDocument } from '@/features/legal/domain/legal';

const doc = (id: number, kind: LegalDocument['kind'], version = 1): LegalDocument => ({ id, kind, version, contentUrl: null });
const current = [doc(1, 'privacy_policy'), doc(2, 'terms'), doc(3, 'health_disclaimer')];

describe('requiredConsents', () => {
  it('pide el aviso de salud a quien nunca lo aceptó (US-114)', () => {
    expect(requiredConsents(current, [], ['privacy_policy', 'terms']).map((d) => d.kind)).toEqual(['health_disclaimer']);
  });

  it('no pide nada a quien ya aceptó todo', () => {
    expect(requiredConsents(current, [], ['privacy_policy', 'terms', 'health_disclaimer'])).toEqual([]);
  });

  it('pide la versión nueva de la política (US-113)', () => {
    const pending = [doc(9, 'privacy_policy', 2)];
    expect(requiredConsents(current, pending, ['privacy_policy', 'terms', 'health_disclaimer'])).toEqual(pending);
  });

  it('ignora pendientes que no bloquean la entrada (comunidad)', () => {
    expect(requiredConsents(current, [doc(7, 'community_sharing', 2)], ['health_disclaimer'])).toEqual([]);
  });
});

describe('latestByKind', () => {
  it('se queda con la versión más alta de cada tipo', () => {
    const latest = latestByKind([doc(1, 'terms', 1), doc(5, 'terms', 2), doc(2, 'privacy_policy', 1)]);
    expect(latest.get('terms')?.id).toBe(5);
    expect(latest.get('privacy_policy')?.id).toBe(2);
  });
});
