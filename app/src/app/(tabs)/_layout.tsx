import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/shared/theme/use-theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Tres preguntas, tres pestañas (ADR-024): ¿qué cocino hoy? · ¿qué tengo y qué me falta? · ¿cómo va mi semana?
const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'tabs.today', icon: 'restaurant-outline' },
  { name: 'kitchen', label: 'tabs.kitchen', icon: 'basket-outline' },
  { name: 'week', label: 'tabs.week', icon: 'calendar-outline' },
];

export default function TabsLayout() {
  const { t } = useTranslation();
  const c = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Barra en Space Cadet con la pestaña activa en Tan, como la paleta de marca.
        tabBarActiveTintColor: c.onBrand,
        tabBarInactiveTintColor: c.onBrandMuted,
        tabBarStyle: { backgroundColor: c.brand, borderTopWidth: 0 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}>
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.label),
            tabBarAccessibilityLabel: t(tab.label),
            tabBarIcon: ({ color, size }) => <Ionicons name={tab.icon} color={color} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
