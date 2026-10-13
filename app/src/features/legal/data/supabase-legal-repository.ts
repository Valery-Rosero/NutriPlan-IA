import type { SupabaseClient } from '@supabase/supabase-js';

import { AppError, toAppError } from '@/core/errors/app-error';
import {
  latestByKind,
  type LegalDocKind,
  type LegalDocument,
  type LegalRepository,
} from '@/features/legal/domain/legal';
import type { Database } from '@/types/database';

type Drafts = Partial<Record<LegalDocKind, string>>;
type FetchText = (url: string) => Promise<string>;

const defaultFetchText: FetchText = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new AppError('network');
  return response.text();
};

export class SupabaseLegalRepository implements LegalRepository {
  private readonly client: SupabaseClient<Database>;
  private readonly drafts: Drafts;
  private readonly fetchText: FetchText;

  constructor(client: SupabaseClient<Database>, drafts: Drafts, fetchText: FetchText = defaultFetchText) {
    this.client = client;
    this.drafts = drafts;
    this.fetchText = fetchText;
  }

  async getCurrentDocuments() {
    const { data, error } = await this.client.from('legal_documents').select('id, kind, version, content_url');
    if (error) throw toAppError(error);
    const docs = data.map((d) => ({ id: d.id, kind: d.kind, version: d.version, contentUrl: d.content_url }));
    return [...latestByKind(docs).values()];
  }

  async getPendingConsents() {
    const { data, error } = await this.client.from('my_pending_consents').select('document_id, kind, version');
    if (error) throw toAppError(error);
    return data.flatMap((d) =>
      d.document_id !== null && d.kind !== null && d.version !== null
        ? [{ id: d.document_id, kind: d.kind, version: d.version, contentUrl: null }]
        : [],
    );
  }

  async getAcceptedKinds() {
    const { data, error } = await this.client
      .from('user_consents')
      .select('legal_documents!inner(kind)')
      .is('revoked_at', null);
    if (error) throw toAppError(error);
    return [...new Set(data.map((row) => row.legal_documents.kind))];
  }

  async accept(documentIds: number[]) {
    // En orden: si una falla, las anteriores ya quedaron registradas y se puede reintentar (accept_consent es idempotente).
    for (const id of documentIds) {
      const { error } = await this.client.rpc('accept_consent', { p_document_id: id });
      if (error) throw toAppError(error);
    }
  }

  async revoke(kind: 'sensitive_data_authorization' | 'community_sharing') {
    const { error } = await this.client.rpc('revoke_consent', { p_kind: kind });
    if (error) throw toAppError(error);
  }

  async getText(document: LegalDocument) {
    if (document.contentUrl) return this.fetchText(document.contentUrl);
    const draft = this.drafts[document.kind];
    if (!draft) throw new AppError('unknown');
    return draft;
  }
}
