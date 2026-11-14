// Debe ir primero: Supabase Auth necesita crypto.subtle para PKCE.
import '@/infrastructure/polyfills/web-crypto';
import '@/infrastructure/i18n';

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { computeGates } from '@/core/startup/gates';
import { createServices } from '@/di/create-services';
import { ServicesProvider } from '@/di/services';
import { SessionProvider, useSession } from '@/features/auth/application/session';
import { useRequiredConsents } from '@/features/legal/application/legal-queries';
import { useProfile } from '@/features/profile/application/profile-queries';
import { registerShoppingMutations } from '@/features/shopping/application/shopping-queries';
import { installGlobalErrorHandler, reportError } from '@/infrastructure/errors/error-reporter';
import { configureForegroundNotifications } from '@/infrastructure/push/expo-push';
import { useNotificationTaps } from '@/infrastructure/push/notification-taps';
import { persister, queryClient, shouldPersistQuery } from '@/infrastructure/query-client';
import { Colors, type ThemeColors } from '@/shared/theme/colors';
import { restoreThemePreference } from '@/shared/theme/theme-preference';
import { useIsOnline } from '@/shared/hooks/use-is-online';
import { useTheme } from '@/shared/theme/use-theme';
import { CrashState } from '@/shared/ui';

SplashScreen.preventAutoHideAsync();
installGlobalErrorHandler(); // US-122: errores JS fuera de React también se registran
configureForegroundNotifications(); // US-148: los avisos también se ven con la app abierta
void restoreThemePreference(); // claro / oscuro / sistema, según lo que eligió la persona

// Tema de navegación con la paleta de marca (fondos de pantalla y transiciones sin destellos blancos o negros).
const navigationThemes = {
  light: { ...DefaultTheme, colors: { ...DefaultTheme.colors, ...navColors(Colors.light) } },
  dark: { ...DarkTheme, colors: { ...DarkTheme.colors, ...navColors(Colors.dark) } },
};

function navColors(c: ThemeColors) {
  return { primary: c.primary, background: c.background, card: c.surface, text: c.text, border: c.border, notification: c.danger };
}

/**
 * US-122: si una pantalla falla, se registra (limpio, sin datos de la persona) y se muestra un camino para
 * seguir en vez de cerrar la app. "Reintentar" vuelve a dibujar la ruta.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    void reportError(error, 'pantalla');
    void SplashScreen.hideAsync(); // si falla durante el arranque, que no quede escondido detrás del splash
  }, [error]);
  return <CrashState onRetry={() => void retry()} />;
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
  const online = useIsOnline();
  const consents = useRequiredConsents(session?.userId);
  const consentsOk = !!session && consents.isSuccess && (consents.data?.length ?? 0) === 0;
  const profile = useProfile(consentsOk);
  const { ready, mustConsent, mustOnboard, inApp } = computeGates({
    hasSession: !!session,
    sessionLoading: loading,
    fontsReady: true, // letra del sistema (Roboto): no hay fuentes que esperar
    online,
    consents: { pending: consents.isPending, error: consents.isError, success: consents.isSuccess, toAccept: consents.data?.length ?? 0 },
    profile: {
      pending: profile.isPending,
      error: profile.isError,
      success: profile.isSuccess,
      onboarded: !!profile.data?.onboardingCompletedAt,
    },
  });

  useNotificationTaps(inApp); // tocar un aviso abre la receta o la semana

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // "Cocina viva": encabezados internos claros, del color del fondo (el sabor va en el contenido).
        headerStyle: { backgroundColor: c.background },
        headerTintColor: c.text,
        headerTitleStyle: { fontSize: 20, fontWeight: '700' },
        headerShadowVisible: false,
      }}>
      <Stack.Protected guard={inApp}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile/index" options={{ headerShown: true, title: '' }} />
        <Stack.Screen name="profile/[section]" />
        <Stack.Screen name="pantry/add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pantry/item" options={{ presentation: 'modal' }} />
        <Stack.Screen name="recipe/[id]" />
        <Stack.Screen name="plan/swap/[mealId]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="plan/changes" />
        <Stack.Screen name="account/delete" />
        <Stack.Screen name="design-system" />
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
