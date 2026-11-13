import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';

import { FloatingTabBar, type FloatingTabBarProps, type TabSpec } from '@/shared/ui/floating-tab-bar';

// Cuatro pestañas (ADR-024 + "Cocina viva"): ¿qué cocino hoy? · ¿qué tengo y qué me falta? · ¿cómo va mi
// semana? · pregúntale al asistente. Cada una con su sabor.
const TABS: Record<string, TabSpec> = {
  index: { label: 'tabs.today', icon: 'restaurant-outline', iconActive: 'restaurant', flavor: 'tomato' },
  kitchen: { label: 'tabs.kitchen', icon: 'basket-outline', iconActive: 'basket', flavor: 'basil' },
  week: { label: 'tabs.week', icon: 'calendar-outline', iconActive: 'calendar', flavor: 'mango' },
  assistant: { label: 'tabs.assistant', icon: 'sparkles-outline', iconActive: 'sparkles', flavor: 'berry' },
};
const ORDER = ['index', 'kitchen', 'week', 'assistant'] as const;

// Tocar la pestaña Asistente directamente empieza una conversación nueva (sin la comida de una vez anterior).
const RESET_PARAMS = { assistant: { mealId: undefined, mealTitle: undefined } };

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export default function TabsLayout() {
  return (
    <Tabs
      // "Atrás" vuelve a la pestaña anterior (p. ej. de Asistente a Mi semana), no siempre a Hoy.
      backBehavior="history"
      screenOptions={{ headerShown: false }}
      tabBar={(props: TabBarProps) => (
        <FloatingTabBar {...(props as unknown as FloatingTabBarProps)} tabs={TABS} resetParams={RESET_PARAMS} />
      )}>
      {ORDER.map((name) => (
        <Tabs.Screen key={name} name={name} />
      ))}
    </Tabs>
  );
}
