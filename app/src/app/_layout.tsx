import '@/infrastructure/i18n';

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { createServices } from '@/di/create-services';
import { ServicesProvider } from '@/di/services';
import { SessionProvider, useSession } from '@/features/auth/application/session';
import { useRequiredConsents } from '@/features/legal/application/legal-queries';
import { persister, queryClient, shouldPersistQuery } from '@/infrastructure/query-client';
import { Colors, type ThemeColors } from '@/shared/theme/colors';

SplashScreen.preventAutoHideAsync();

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
  const [services] = useState(createServices);
  return (
    <ServicesProvider services={services}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery } }}>
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
 * Tres puertas, en orden: sin sesión → (auth); con documentos por aceptar → consents; si no → (tabs).
 * Las rutas de enlaces de correo y los documentos legales están disponibles siempre.
 */
function RootNavigator() {
  const { session, loading } = useSession();
  const consents = useRequiredConsents(session?.userId);
  const checkingConsents = !!session && consents.isPending;
  const mustConsent = !!session && (consents.isError || (consents.data?.length ?? 0) > 0);
  const ready = !loading && !checkingConsents;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session && !mustConsent}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={mustConsent}>
        <Stack.Screen name="consents" />
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
