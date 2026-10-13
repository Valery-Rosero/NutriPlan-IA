import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { ServicesProvider, type Services } from '@/di/services';
import type { AuthRepository } from '@/features/auth/domain/auth-repository';
import { createLoginThrottle } from '@/features/auth/domain/login-throttle';
import type { LegalDocument, LegalRepository } from '@/features/legal/domain/legal';
import type { PantryRepository } from '@/features/pantry/domain/pantry';
import type { Profile, ProfileRepository } from '@/features/profile/domain/profile';
import type { RecipeDetail, RecipeRepository } from '@/features/recipes/domain/recipe';

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
    revoke: jest.fn(async () => {}),
    getText: jest.fn(async () => '# Documento'),
    ...overrides,
  } as jest.Mocked<LegalRepository>;
}

export const PROFILE: Profile = {
  id: 'u1', regionId: 3, householdSize: 4, budgetAmount: null, budgetPeriod: null, onboardingCompletedAt: '2026-10-13T00:00:00Z',
};

export function fakeProfile(overrides: Partial<ProfileRepository> = {}): jest.Mocked<ProfileRepository> {
  return {
    getProfile: jest.fn(async () => PROFILE),
    updateProfile: jest.fn(async () => {}),
    getRestrictions: jest.fn(async () => ({ allergenIds: [], dietIds: [] })),
    setRestrictions: jest.fn(async () => {}),
    listRegions: jest.fn(async () => [{ id: 3, code: 'CO-NAR-PASTO', name: 'Pasto' }]),
    listAllergens: jest.fn(async () => [{ id: 5, code: 'egg', name: 'Huevo' }, { id: 6, code: 'milk', name: 'Leche' }]),
    listDiets: jest.fn(async () => [{ id: 2, code: 'vegan', name: 'Vegano' }]),
    ...overrides,
  } as jest.Mocked<ProfileRepository>;
}

export function fakePantry(overrides: Partial<PantryRepository> = {}): jest.Mocked<PantryRepository> {
  return {
    list: jest.fn(async () => []),
    add: jest.fn(async () => {}),
    remove: jest.fn(async () => {}),
    search: jest.fn(async () => []),
    listUnits: jest.fn(async () => [{ id: 1, code: 'g', name: 'gramo', dimension: 'mass' as const }]),
    ...overrides,
  } as jest.Mocked<PantryRepository>;
}

export const RECIPE: RecipeDetail = {
  id: 'r1', title: 'Arroz salteado con lo que tengas', description: null, totalMinutes: 40, baseServings: 4, keepsDays: 3,
  slots: ['lunch', 'dinner'], steps: ['Cocina el arroz.', 'Saltea todo.'],
  groups: [{
    key: 1, label: 'Proteína', min: 1, max: 1,
    options: [
      { ingredientId: 'pollo', name: 'Pechuga de pollo', inPantry: false, isDefault: true, selected: false },
      { ingredientId: 'cerdo', name: 'Cerdo', inPantry: true, isDefault: false, selected: true },
    ],
  }],
};

export function fakeRecipes(overrides: Partial<RecipeRepository> = {}): jest.Mocked<RecipeRepository> {
  return {
    getDetail: jest.fn(async () => RECIPE),
    preview: jest.fn(async () => ({
      lines: [
        { ingredient_id: 'arroz', ingredient_name: 'Arroz blanco', quantity: 300, unit_code: 'g', grams: 300, is_optional: false, group_key: null, group_label: null, in_pantry: false },
        { ingredient_id: 'cerdo', ingredient_name: 'Cerdo', quantity: 400, unit_code: 'g', grams: 400, is_optional: false, group_key: 1, group_label: 'Proteína', in_pantry: true },
      ],
      per_serving: { kcal: 420, protein_g: 25, carbs_g: 60, fat_g: 8, fiber_g: 2, sugar_g: 1, sodium_mg: 300 },
      allergens: [],
    })),
    cookNow: jest.fn(async () => ({ plannedMealId: 'pm1', shortfall: [{ ingredientId: 'arroz', name: 'Arroz blanco', missingGrams: 300 }] })),
    undoCook: jest.fn(async () => {}),
    ...overrides,
  } as jest.Mocked<RecipeRepository>;
}

export function fakeServices(overrides: Partial<Services> = {}): Services {
  return {
    auth: fakeAuth(),
    legal: fakeLegal(),
    cooking: { suggestions: jest.fn(async () => []) },
    profile: fakeProfile(),
    pantry: fakePantry(),
    recipes: fakeRecipes(),
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
