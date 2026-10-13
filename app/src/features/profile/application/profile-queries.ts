import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppError } from '@/core/errors/app-error';
import { useServices } from '@/di/services';
import { cookingKeys } from '@/features/cooking/application/use-suggestions';
import { legalKeys, useCurrentDocuments } from '@/features/legal/application/legal-queries';
import type { ProfilePatch, Restrictions } from '@/features/profile/domain/profile';

export const profileKeys = {
  all: ['profile'] as const,
  me: () => [...profileKeys.all, 'me'] as const,
  restrictions: () => [...profileKeys.all, 'restrictions'] as const,
  options: (kind: 'regions' | 'allergens' | 'diets') => [...profileKeys.all, 'options', kind] as const,
  sensitive: () => [...profileKeys.all, 'sensitive'] as const,
};

export function useProfile(enabled = true) {
  const { profile } = useServices();
  return useQuery({ queryKey: profileKeys.me(), queryFn: () => profile.getProfile(), enabled });
}

export function useUpdateProfile() {
  const { profile } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProfilePatch) => profile.updateProfile(patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKeys.me() }),
  });
}

export function useRestrictions() {
  const { profile } = useServices();
  return useQuery({ queryKey: profileKeys.restrictions(), queryFn: () => profile.getRestrictions() });
}

/** Cambiar alergias o dietas cambia lo que se puede cocinar: se recalculan las sugerencias. */
export function useSetRestrictions() {
  const { profile } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (restrictions: Restrictions) => profile.setRestrictions(restrictions),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.restrictions() });
      void queryClient.invalidateQueries({ queryKey: cookingKeys.all });
    },
  });
}

export function useProfileOptions() {
  const { profile } = useServices();
  const opts = { staleTime: 60 * 60_000 };
  const regions = useQuery({ queryKey: profileKeys.options('regions'), queryFn: () => profile.listRegions(), ...opts });
  const allergens = useQuery({ queryKey: profileKeys.options('allergens'), queryFn: () => profile.listAllergens(), ...opts });
  const diets = useQuery({ queryKey: profileKeys.options('diets'), queryFn: () => profile.listDiets(), ...opts });
  return { regions, allergens, diets };
}

/** ¿Tiene vigente la autorización de datos sensibles (ADR-011)? */
export function useSensitiveAuthorization() {
  const { legal } = useServices();
  return useQuery({
    queryKey: profileKeys.sensitive(),
    queryFn: async () => (await legal.getAcceptedKinds()).includes('sensitive_data_authorization'),
  });
}

export function useGrantSensitiveAuthorization() {
  const { legal } = useServices();
  const queryClient = useQueryClient();
  const current = useCurrentDocuments();
  return useMutation({
    mutationFn: async () => {
      const doc = current.data?.find((d) => d.kind === 'sensitive_data_authorization');
      if (!doc) throw new AppError('consent_required');
      await legal.accept([doc.id]);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.sensitive() });
      void queryClient.invalidateQueries({ queryKey: legalKeys.all });
    },
  });
}

/** Revocar borra alergias, dietas y datos de salud (R4): los planes dejan de filtrarlas. */
export function useRevokeSensitiveAuthorization() {
  const { legal } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => legal.revoke('sensitive_data_authorization'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.all });
      void queryClient.invalidateQueries({ queryKey: cookingKeys.all });
    },
  });
}
