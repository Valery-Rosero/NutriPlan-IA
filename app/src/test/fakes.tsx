import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { ServicesProvider, type Services } from '@/di/services';
import type { AuthRepository } from '@/features/auth/domain/auth-repository';
import { createLoginThrottle } from '@/features/auth/domain/login-throttle';
import type { LegalDocument, LegalRepository } from '@/features/legal/domain/legal';

export const CURRENT_DOCUMENTS: LegalDocument[] = [
  { id: 1, kind: 'privacy_policy', version: 1, contentUrl: null },
  { id: 2, kind: 'terms', version: 1, contentUrl: null },
  { id: 3, kind: 'health_disclaimer', version: 1, contentUrl: null },
];

export function fakeAuth(overrides: Partial<AuthRepository> = {}): jest.Mocked<AuthRepository> {
  return {
    getSession: jest.fn(async () => null),
    onSessionChange: jest.fn(() => () => {}),
    signUp: jest.fn(async () => 'confirmation_sent' as const),
    signIn: jest.fn(async () => {}),
    signOut: jest.fn(async () => {}),
    resendConfirmation: jest.fn(async () => {}),
    requestPasswordReset: jest.fn(async () => {}),
    exchangeCode: jest.fn(async () => {}),
    updatePassword: jest.fn(async () => {}),
    ...overrides,
  } as jest.Mocked<AuthRepository>;
}

export function fakeLegal(overrides: Partial<LegalRepository> = {}): jest.Mocked<LegalRepository> {
  return {
    getCurrentDocuments: jest.fn(async () => CURRENT_DOCUMENTS),
    getPendingConsents: jest.fn(async () => []),
    getAcceptedKinds: jest.fn(async () => []),
    accept: jest.fn(async () => {}),
    getText: jest.fn(async () => '# Documento'),
    ...overrides,
  } as jest.Mocked<LegalRepository>;
}

export function fakeServices(overrides: Partial<Services> = {}): Services {
  return {
    auth: fakeAuth(),
    legal: fakeLegal(),
    cooking: { suggestions: jest.fn(async () => []) },
    loginThrottle: createLoginThrottle(),
    ...overrides,
  };
}

/** Envoltorio de pruebas: caché aislada por prueba y servicios falsos inyectados. */
export function withServices(services: Services) {
  const queryClient = new QueryClient({
    // gcTime infinito: sin temporizadores pendientes que impidan que Jest termine.
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ServicesProvider services={services}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ServicesProvider>
    );
  };
}
