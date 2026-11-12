import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Linking from 'expo-linking';

import type { Services } from '@/di/services';
import { SupabaseAccountRepository } from '@/features/account/data/supabase-account-repository';
import { SupabaseAnalyticsRepository } from '@/features/analytics/data/supabase-analytics-repository';
import { SupabaseAssistantRepository } from '@/features/assistant/data/supabase-assistant-repository';
import { SupabaseAuthRepository } from '@/features/auth/data/supabase-auth-repository';
import { createLoginThrottle } from '@/features/auth/domain/login-throttle';
import { SupabaseCookingRepository } from '@/features/cooking/data/supabase-cooking-repository';
import { legalDrafts } from '@/features/legal/data/legal-drafts.generated';
import { SupabaseLegalRepository } from '@/features/legal/data/supabase-legal-repository';
import { SupabaseNutritionRepository } from '@/features/nutrition/data/supabase-nutrition-repository';
import { SupabasePantryRepository } from '@/features/pantry/data/supabase-pantry-repository';
import { SupabasePlanRepository } from '@/features/plan/data/supabase-plan-repository';
import { SupabaseProfileRepository } from '@/features/profile/data/supabase-profile-repository';
import { SupabaseRecipeRepository } from '@/features/recipes/data/supabase-recipe-repository';
import { SupabaseShoppingRepository } from '@/features/shopping/data/supabase-shopping-repository';
import { SupabaseSpendingRepository } from '@/features/spending/data/supabase-spending-repository';
import { SupabaseSupportRepository } from '@/features/support/data/supabase-support-repository';
import { anonymousId } from '@/infrastructure/analytics/anonymous-id';
import { supabase } from '@/infrastructure/supabase/client';

/** Raíz de composición: único lugar que conoce las implementaciones concretas. */
export function createServices(): Services {
  return {
    auth: new SupabaseAuthRepository(supabase, (path) => Linking.createURL(path)),
    legal: new SupabaseLegalRepository(supabase, legalDrafts),
    cooking: new SupabaseCookingRepository(supabase),
    profile: new SupabaseProfileRepository(supabase),
    pantry: new SupabasePantryRepository(supabase),
    recipes: new SupabaseRecipeRepository(supabase),
    plans: new SupabasePlanRepository(supabase),
    shopping: new SupabaseShoppingRepository(supabase),
    account: new SupabaseAccountRepository(supabase),
    assistant: new SupabaseAssistantRepository(supabase),
    spending: new SupabaseSpendingRepository(supabase),
    nutrition: new SupabaseNutritionRepository(supabase),
    analytics: new SupabaseAnalyticsRepository(supabase, anonymousId, Constants.expoConfig?.version ?? null),
    // Solo versión y modelo (US-151): nada de salud ni de perfil.
    support: new SupabaseSupportRepository(supabase, () => ({
      appVersion: Constants.expoConfig?.version ?? null,
      deviceModel: Device.modelName ?? null,
    })),
    loginThrottle: createLoginThrottle(),
  };
}
