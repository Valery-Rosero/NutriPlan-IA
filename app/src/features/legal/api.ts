import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type LegalKind = Database['public']['Enums']['legal_doc_kind'];
export type LegalDocument = { id: number; kind: LegalKind; version: number; content_url: string | null };

/** Versión vigente de cada documento legal. Se lee sin sesión: el registro necesita sus ids. */
export function useCurrentLegalDocuments() {
  return useQuery({
    queryKey: ['legal', 'current'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('legal_documents')
        .select('id, kind, version, content_url')
        .order('version', { ascending: false });
      if (error) throw error;
      const latest = new Map<LegalKind, LegalDocument>();
      for (const doc of data) if (!latest.has(doc.kind)) latest.set(doc.kind, doc);
      return latest;
    },
  });
}
