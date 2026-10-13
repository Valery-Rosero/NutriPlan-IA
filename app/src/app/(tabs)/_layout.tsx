import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/hooks/use-theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'tabs.cook', icon: 'restaurant-outline' },
  { name: 'plan', label: 'tabs.plan', icon: 'calendar-outline' },
  { name: 'shopping', label: 'tabs.shopping', icon: 'cart-outline' },
  { name: 'pantry', label: 'tabs.pantry', icon: 'basket-outline' },
  { name: 'profile', label: 'tabs.profile', icon: 'person-outline' },
];

export default function TabsLayout() {
  const { t } = useTranslation();
  const c = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textSecondary,
        tabBarStyle: { backgroundColor: c.background, borderTopColor: c.border },
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
