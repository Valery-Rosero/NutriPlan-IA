export type LegalDocKind =
  | 'privacy_policy'
  | 'terms'
  | 'health_disclaimer'
  | 'community_sharing'
  | 'sensitive_data_authorization';

export type LegalDocument = { id: number; kind: LegalDocKind; version: number; contentUrl: string | null };

/** Puerto de documentos legales y consentimientos. Falla con AppError. */
export interface LegalRepository {
  /** Versión vigente de cada documento (se puede leer sin sesión). */
  getCurrentDocuments(): Promise<LegalDocument[]>;
  /** Versiones nuevas de documentos ya aceptados (vista my_pending_consents). */
  getPendingConsents(): Promise<LegalDocument[]>;
  /** Tipos de documento que la persona tiene aceptados y vigentes (sin revocar). */
  getAcceptedKinds(): Promise<LegalDocKind[]>;
  accept(documentIds: number[]): Promise<void>;
  /** Revoca una autorización revocable; la base borra los datos que dependían de ella (R4). */
  revoke(kind: 'sensitive_data_authorization' | 'community_sharing'): Promise<void>;
  /** Texto del documento: el publicado si existe, si no el borrador incluido en la app. */
  getText(document: LegalDocument): Promise<string>;
}

/**
 * Política de acceso (regla de dominio pura): qué documentos debe aceptar la persona antes de usar la app.
 * - Privacidad y términos: siempre la versión vigente (vienen de my_pending_consents).
 * - Aviso de salud (US-114): se acepta una vez al empezar, antes de recibir sugerencias.
 */
export function requiredConsents(
  current: LegalDocument[],
  pending: LegalDocument[],
  acceptedKinds: LegalDocKind[],
): LegalDocument[] {
  const required = pending.filter((d) => d.kind === 'privacy_policy' || d.kind === 'terms');
  const health = current.find((d) => d.kind === 'health_disclaimer');
  if (health && !acceptedKinds.includes('health_disclaimer') && !required.some((d) => d.id === health.id)) {
    required.push(health);
  }
  return required;
}

export function latestByKind(documents: LegalDocument[]): Map<LegalDocKind, LegalDocument> {
  const latest = new Map<LegalDocKind, LegalDocument>();
  for (const doc of [...documents].sort((a, b) => b.version - a.version)) {
    if (!latest.has(doc.kind)) latest.set(doc.kind, doc);
  }
  return latest;
}
