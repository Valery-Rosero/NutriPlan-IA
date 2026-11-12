// Debe ir primero: Supabase Auth necesita crypto.subtle para PKCE.
import '@/infrastructure/polyfills/web-crypto';
import '@/infrastructure/i18n';

import { DMSerifDisplay_400Regular, useFonts } from '@expo-google-fonts/dm-serif-display';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { createServices } from '@/di/create-services';
import { ServicesProvider } from '@/di/services';
import { SessionProvider, useSession } from '@/features/auth/application/session';
import { useRequiredConsents } from '@/features/legal/application/legal-queries';
import { useProfile } from '@/features/profile/application/profile-queries';
import { registerShoppingMutations } from '@/features/shopping/application/shopping-queries';
import { persister, queryClient, shouldPersistQuery } from '@/infrastructure/query-client';
import { Colors, type ThemeColors } from '@/shared/theme/colors';
import { restoreThemePreference } from '@/shared/theme/theme-preference';
import { DisplayFont } from '@/shared/theme/tokens';
import { computeGates } from '@/core/startup/gates';
import { useIsOnline } from '@/shared/hooks/use-is-online';
import { useTheme } from '@/shared/theme/use-theme';

SplashScreen.preventAutoHideAsync();
void restoreThemePreference(); // claro / oscuro / sistema, según lo que eligió la persona

// Tema de navegación con la paleta de marca (fondos de pantalla y transiciones sin destellos blancos o negros).
const navigationThemes = {
  light: { ...DefaultTheme, colors: { ...DefaultTheme.colors, ...navColors(Colors.light) } },
  dark: { ...DarkTheme, colors: { ...DarkTheme.colors, ...navColors(Colors.dark) } },
};

function navColors(c: ThemeColors) {
  return { primary: c.primary, background: c.background, card: c.surface, text: c.text, border: c.border, notification: c.danger };
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const [services] = useState(() => {
    const created = createServices();
    registerShoppingMutations(queryClient, created); // para reanudar casillas pendientes tras reiniciar
    return created;
  });
  return (
    <ServicesProvider services={services}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery } }}
        onSuccess={() => void queryClient.resumePausedMutations()}>
        <SessionProvider>
          <ThemeProvider value={scheme === 'dark' ? navigationThemes.dark : navigationThemes.light}>
            <RootNavigator />
          </ThemeProvider>
        </SessionProvider>
      </PersistQueryClientProvider>
    </ServicesProvider>
  );
}

/**
 * Puertas, en orden: sin sesión → (auth); documentos por aceptar → consents;
 * onboarding sin terminar → onboarding; si no → la app. Enlaces de correo y documentos legales, siempre.
 */
function RootNavigator() {
  const { session, loading } = useSession();
  const c = useTheme();
  // Tipografía de títulos (serif de la marca). Si no carga, se sigue con la del sistema.
  const [fontsLoaded, fontError] = useFonts({ DMSerifDisplay_400Regular });
  const online = useIsOnline();
  const consents = useRequiredConsents(session?.userId);
  const consentsOk = !!session && consents.isSuccess && (consents.data?.length ?? 0) === 0;
  const profile = useProfile(consentsOk);
  const { ready, mustConsent, mustOnboard, inApp } = computeGates({
    hasSession: !!session,
    sessionLoading: loading,
    fontsReady: fontsLoaded || !!fontError,
    online,
    consents: { pending: consents.isPending, error: consents.isError, success: consents.isSuccess, toAccept: consents.data?.length ?? 0 },
    profile: {
      pending: profile.isPending,
      error: profile.isError,
      success: profile.isSuccess,
      onboarded: !!profile.data?.onboardingCompletedAt,
    },
  });

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Encabezados de pantallas internas en Space Cadet con título Tan (paleta de marca).
        headerStyle: { backgroundColor: c.brand },
        headerTintColor: c.onBrand,
        headerTitleStyle: { fontFamily: DisplayFont, fontSize: 20 },
        headerShadowVisible: false,
      }}>
      <Stack.Protected guard={inApp}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile/index" options={{ headerShown: true, title: '' }} />
        <Stack.Screen name="profile/[section]" />
        <Stack.Screen name="pantry/add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="recipe/[id]" />
        <Stack.Screen name="plan/swap/[mealId]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="account/delete" />
        <Stack.Screen name="design-system" />
        <Stack.Screen name="assistant" />
        <Stack.Screen name="help" />
      </Stack.Protected>
      <Stack.Protected guard={mustConsent}>
        <Stack.Screen name="consents" />
      </Stack.Protected>
      <Stack.Protected guard={mustOnboard}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen name="auth-callback" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="legal/[kind]" />
    </Stack>
  );
}
