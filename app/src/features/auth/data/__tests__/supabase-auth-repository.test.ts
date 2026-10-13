import type { SupabaseClient } from '@supabase/supabase-js';

import { AppError } from '@/core/errors/app-error';
import { mapAuthError, SupabaseAuthRepository } from '@/features/auth/data/supabase-auth-repository';

function clientWith(auth: Record<string, jest.Mock>) {
  return { auth } as unknown as Pick<SupabaseClient, 'auth'>;
}

const input = {
  email: 'ana@correo.com',
  password: 'Arepa2026',
  privacyPolicyDocumentId: 1,
  termsDocumentId: 2,
  isAdult: true as const,
};

describe('SupabaseAuthRepository.signUp', () => {
  it('envía los ids vigentes y la mayoría de edad que exige el trigger de registro', async () => {
    const signUp = jest.fn(async () => ({ data: { user: { identities: [{}] }, session: null }, error: null }));
    const repo = new SupabaseAuthRepository(clientWith({ signUp }), (p) => `nutriplan://${p}`);

    await expect(repo.signUp(input)).resolves.toBe('confirmation_sent');
    expect(signUp).toHaveBeenCalledWith({
      email: 'ana@correo.com',
      password: 'Arepa2026',
      options: {
        emailRedirectTo: 'nutriplan://auth-callback',
        data: { privacy_policy_document_id: 1, terms_document_id: 2, is_adult: true },
      },
    });
  });

  it('detecta un correo ya registrado aunque Supabase no lo diga (usuario sin identidades)', async () => {
    const signUp = jest.fn(async () => ({ data: { user: { identities: [] }, session: null }, error: null }));
    const repo = new SupabaseAuthRepository(clientWith({ signUp }), (p) => p);
    await expect(repo.signUp(input)).rejects.toMatchObject({ code: 'email_taken' });
  });
});

describe('mapAuthError (capa anticorrupción)', () => {
  it.each([
    [{ code: 'invalid_credentials', status: 400 }, 'invalid_credentials'],
    [{ code: 'email_not_confirmed', status: 400 }, 'email_not_confirmed'],
    [{ code: 'user_already_exists', status: 422 }, 'email_taken'],
    [{ code: 'over_request_rate_limit', status: 429 }, 'rate_limited'],
    [{ status: 429 }, 'rate_limited'],
    [{ code: 'flow_state_not_found', status: 404 }, 'link_expired'],
    [{ message: 'Database error saving new user', status: 500 }, 'signup_failed'],
    [{ message: 'algo raro', status: 500 }, 'unknown'],
  ])('%j → %s', (error, code) => {
    expect(mapAuthError(error).code).toBe(code);
  });

  it('deja pasar un AppError', () => {
    const error = new AppError('network');
    expect(mapAuthError(error)).toBe(error);
  });
});
