import type { LegalDocKind } from '@/features/legal/domain/legal';

/** Ruta tipada al visor de un documento legal. */
export const legalHref = (kind: LegalDocKind) => ({ pathname: '/legal/[kind]', params: { kind } }) as const;
