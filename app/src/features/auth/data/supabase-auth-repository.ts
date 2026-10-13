import type { Session, SupabaseClient } from '@supabase/supabase-js';

import { AppError, toAppError } from '@/core/errors/app-error';
import type { AuthRepository, AuthSession, Credentials, SignUpInput, SignUpOutcome } from '@/features/auth/domain/auth-repository';

type AuthClient = Pick<SupabaseClient, 'auth'>;

/** Capa anticorrupción: los códigos de Supabase Auth se traducen a códigos de dominio. */
export function mapAuthError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const e = (error ?? {}) as { code?: string; status?: number; message?: string };
  // El trigger de registro (consentimientos, mayoría de edad) llega como este mensaje genérico.
  if (/database error saving new user/i.test(e.message ?? '')) return new AppError('signup_failed', error);
  switch (e.code) {
    case 'invalid_credentials':
      return new AppError('invalid_credentials', error);
    case 'email_not_confirmed':
      return new AppError('email_not_confirmed', error);
    case 'user_already_exists':
    case 'email_exists':
      return new AppError('email_taken', error);
    case 'weak_password':
      return new AppError('weak_password', error);
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return new AppError('rate_limited', error);
    case 'otp_expired':
    case 'flow_state_not_found':
    case 'flow_state_expired':
    case 'bad_code_verifier':
      return new AppError('link_expired', error);
  }
  if (e.status === 429) return new AppError('rate_limited', error);
  return toAppError(error);
}

function toSession(session: Session | null): AuthSession | null {
  return session ? { userId: session.user.id, email: session.user.email ?? null } : null;
}

export class SupabaseAuthRepository implements AuthRepository {
  private readonly client: AuthClient;
  /** Construye la URL de retorno de los correos (nutriplan://… o exp://…/-- en Expo Go). */
  private readonly redirectUrl: (path: string) => string;

  constructor(client: AuthClient, redirectUrl: (path: string) => string) {
    this.client = client;
    this.redirectUrl = redirectUrl;
  }

  async getSession() {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw mapAuthError(error);
    return toSession(data.session);
  }

  onSessionChange(listener: (session: AuthSession | null) => void) {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => listener(toSession(session)));
    return () => data.subscription.unsubscribe();
  }

  async signUp({ email, password, privacyPolicyDocumentId, termsDocumentId, isAdult }: SignUpInput): Promise<SignUpOutcome> {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: this.redirectUrl('auth-callback'),
        // El trigger private.handle_new_user exige estos tres datos (AGENTS.md regla 3).
        data: {
          privacy_policy_document_id: privacyPolicyDocumentId,
          terms_document_id: termsDocumentId,
          is_adult: isAdult,
        },
      },
    });
    if (error) throw mapAuthError(error);
    // Con confirmación de correo, Supabase no revela si el correo existe: devuelve un usuario sin identidades.
    if (data.user && data.user.identities?.length === 0) throw new AppError('email_taken');
    return data.session ? 'signed_in' : 'confirmation_sent';
  }

  async signIn({ email, password }: Credentials) {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw mapAuthError(error);
  }

  async signOut() {
    const { error } = await this.client.auth.signOut();
    if (error) throw mapAuthError(error);
  }

  async resendConfirmation(email: string) {
    const { error } = await this.client.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: this.redirectUrl('auth-callback') },
    });
    if (error) throw mapAuthError(error);
  }

  async requestPasswordReset(email: string) {
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: this.redirectUrl('reset-password'),
    });
    if (error) throw mapAuthError(error);
  }

  async exchangeCode(code: string) {
    const { error } = await this.client.auth.exchangeCodeForSession(code);
    if (error) throw mapAuthError(error);
  }

  async updatePassword(password: string) {
    const { error } = await this.client.auth.updateUser({ password });
    if (error) throw mapAuthError(error);
  }
}
