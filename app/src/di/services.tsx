import { createContext, useContext, type ReactNode } from 'react';

import type { AuthRepository } from '@/features/auth/domain/auth-repository';
import type { LoginThrottle } from '@/features/auth/domain/login-throttle';
import type { CookingRepository } from '@/features/cooking/domain/cooking';
import type { LegalRepository } from '@/features/legal/domain/legal';
import type { PantryRepository } from '@/features/pantry/domain/pantry';
import type { PlanRepository } from '@/features/plan/domain/plan';
import type { ProfileRepository } from '@/features/profile/domain/profile';
import type { RecipeRepository } from '@/features/recipes/domain/recipe';
import type { ShoppingRepository } from '@/features/shopping/domain/shopping';

/**
 * Contenedor de dependencias (inyección por contexto). Las features dependen de los puertos;
 * la implementación concreta se decide en un solo lugar (create-services.ts) y en pruebas se pasan dobles.
 */
export type Services = {
  auth: AuthRepository;
  legal: LegalRepository;
  cooking: CookingRepository;
  profile: ProfileRepository;
  pantry: PantryRepository;
  recipes: RecipeRepository;
  plans: PlanRepository;
  shopping: ShoppingRepository;
  loginThrottle: LoginThrottle;
};

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ services, children }: { services: Services; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices debe usarse dentro de <ServicesProvider>');
  return services;
}
