import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useServices } from '@/di/services';
import { requiredConsents, type LegalDocKind, type LegalRepository } from '@/features/legal/domain/legal';

/** Fábrica de claves: un solo lugar decide cómo se nombran e invalidan las consultas legales. */
export const legalKeys = {
  all: ['legal'] as const,
  current: () => [...legalKeys.all, 'current'] as const,
  required: (userId: string) => [...legalKeys.all, 'required', userId] as const,
  text: (kind: LegalDocKind, version: number) => [...legalKeys.all, 'text', kind, version] as const,
};

export const currentDocumentsQuery = (legal: LegalRepository) =>
  queryOptions({ queryKey: legalKeys.current(), queryFn: () => legal.getCurrentDocuments(), staleTime: 5 * 60_000 });

export function useCurrentDocuments() {
  const { legal } = useServices();
  return useQuery(currentDocumentsQuery(legal));
}

/** Documentos que faltan por aceptar para entrar a la app (vacío = puede pasar). */
export function useRequiredConsents(userId: string | undefined) {
  const { legal } = useServices();
  return useQuery({
    queryKey: legalKeys.required(userId ?? 'anon'),
    enabled: !!userId,
    queryFn: async () => {
      const [current, pending, accepted] = await Promise.all([
        legal.getCurrentDocuments(),
        legal.getPendingConsents(),
        legal.getAcceptedKinds(),
      ]);
      return requiredConsents(current, pending, accepted);
    },
  });
}

export function useAcceptConsents() {
  const { legal } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentIds: number[]) => legal.accept(documentIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: legalKeys.all }),
  });
}

export function useLegalText(kind: LegalDocKind) {
  const { legal } = useServices();
  const current = useCurrentDocuments();
  const document = current.data?.find((d) => d.kind === kind);
  const text = useQuery({
    queryKey: legalKeys.text(kind, document?.version ?? 0),
    enabled: !!document,
    queryFn: () => legal.getText(document!),
    staleTime: Infinity,
  });
  return { document, text, isPending: current.isPending || (!!document && text.isPending), error: current.error ?? text.error };
}
