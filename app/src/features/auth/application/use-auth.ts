import { useMutation, useQueryClient } from '@tanstack/react-query';

import { AppError, toAppError } from '@/core/errors/app-error';
import { useServices } from '@/di/services';
import type { Credentials } from '@/features/auth/domain/auth-repository';
import type { SignUpForm } from '@/features/auth/domain/schemas';
import { currentDocumentsQuery } from '@/features/legal/application/legal-queries';
import { latestByKind } from '@/features/legal/domain/legal';

/**
 * Caso de uso: registrarse aceptando las versiones VIGENTES de la política y los términos.
 * Los ids se leen en el momento del registro (no se confía en lo que tenga la pantalla).
 */
export function useSignUp() {
  const { auth, legal } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (form: SignUpForm) => {
      const current = latestByKind(await queryClient.fetchQuery(currentDocumentsQuery(legal)));
      const privacy = current.get('privacy_policy');
      const terms = current.get('terms');
      if (!privacy || !terms) throw new AppError('consent_required');
      return auth.signUp({
        email: form.email,
        password: form.password,
        privacyPolicyDocumentId: privacy.id,
        termsDocumentId: terms.id,
        isAdult: true,
      });
    },
  });
}

/** Caso de uso: iniciar sesión con freno local tras 5 fallos (US-104, ADR-019). */
export function useSignIn() {
  const { auth, loginThrottle } = useServices();
  return useMutation({
    mutationFn: async (credentials: Credentials) => {
      if (loginThrottle.remainingLockMs(credentials.email) > 0) throw new AppError('too_many_attempts');
      try {
        await auth.signIn(credentials);
        loginThrottle.recordSuccess(credentials.email);
      } catch (error) {
        const appError = toAppError(error);
        if (appError.code === 'invalid_credentials') loginThrottle.recordFailure(credentials.email);
        throw appError;
      }
    },
  });
}

export function useSignOut() {
  const { auth } = useServices();
  return useMutation({ mutationFn: () => auth.signOut() });
}

export function useResendConfirmation() {
  const { auth } = useServices();
  return useMutation({ mutationFn: (email: string) => auth.resendConfirmation(email) });
}

export function useRequestPasswordReset() {
  const { auth } = useServices();
  return useMutation({ mutationFn: (email: string) => auth.requestPasswordReset(email) });
}

export function useExchangeCode() {
  const { auth } = useServices();
  return useMutation({ mutationFn: (code: string) => auth.exchangeCode(code) });
}

export function useUpdatePassword() {
  const { auth } = useServices();
  return useMutation({ mutationFn: (password: string) => auth.updatePassword(password) });
}
