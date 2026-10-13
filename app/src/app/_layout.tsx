import '@/lib/i18n';

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { Colors, type ThemeColors } from '@/constants/theme';
import { persister, queryClient, shouldPersistQuery } from '@/lib/query-client';
import { AuthProvider, useAuth } from '@/providers/auth-provider';

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
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery } }}>
      <AuthProvider>
        <ThemeProvider value={scheme === 'dark' ? navigationThemes.dark : navigationThemes.light}>
          <RootNavigator />
        </ThemeProvider>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}

function RootNavigator() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  // Sin sesión solo existe el grupo (auth); con sesión, las pestañas. El onboarding llega en el Sprint 2.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
