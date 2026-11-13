import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { flavorColors, Spacing, type FlavorName } from '@/shared/theme/colors';
import { elevation, Radius } from '@/shared/theme/tokens';
import { useTheme } from '@/shared/theme/use-theme';
import type { IconName } from '@/shared/ui/primitives';

export type TabSpec = { label: string; icon: IconName; iconActive: IconName; flavor: FlavorName };

/** Lo mínimo que la barra necesita del navegador de pestañas (compatible con `tabBar` de expo-router/js-tabs). */
type Route = { key: string; name: string; params?: object };
export type FloatingTabBarProps = {
  state: { index: number; routes: Route[] };
  navigation: {
    emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
};

/** El teclado abierto tapa media pantalla: la barra se esconde mientras tanto (Android). */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

/**
 * Barra de pestañas flotante "Cocina viva": redondeada, con sombra suave, sobre el fondo de la pantalla.
 * Cada pestaña tiene su sabor y la activa se llena con él. El nombre siempre se ve (personas mayores).
 */
export function FloatingTabBar({ state, navigation, tabs, resetParams }: FloatingTabBarProps & {
  tabs: Record<string, TabSpec>;
  /** Pestañas cuyo contexto se limpia al tocarlas directamente (p. ej. el asistente abierto desde una comida). */
  resetParams?: Record<string, object>;
}) {
  const c = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const keyboardOpen = useKeyboardOpen();
  if (keyboardOpen) return null;

  return (
    <View style={[styles.wrap, { backgroundColor: c.background, paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
      <View accessibilityRole="tablist" style={[styles.bar, { backgroundColor: c.card, borderColor: c.divider }, elevation(2, c.shadow)]}>
        {state.routes.map((route, index) => {
          const spec = tabs[route.name];
          if (!spec) return null;
          const focused = state.index === index;
          const f = flavorColors(c, spec.flavor);
          const label = t(spec.label);
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, resetParams?.[route.name] ?? route.params);
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: focused }}
              onPress={onPress}
              style={({ pressed }) => [styles.item, focused && { backgroundColor: f.fill }, pressed && !focused && { backgroundColor: c.surface }]}>
              <Ionicons name={focused ? spec.iconActive : spec.icon} size={22} color={focused ? f.onFill : c.textSecondary} />
              {/* Sin recortar: con letra grande el nombre pasa a dos líneas (nunca se pierde información). */}
              <Text
                maxFontSizeMultiplier={1.3}
                style={[styles.label, { color: focused ? f.onFill : c.textSecondary, fontWeight: focused ? '700' : '600' }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.md, paddingTop: Spacing.xs },
  bar: { flexDirection: 'row', gap: Spacing.xs, padding: 6, borderRadius: Radius.xxl, borderWidth: StyleSheet.hairlineWidth },
  item: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 22, paddingHorizontal: 2 },
  label: { fontSize: 12, lineHeight: 16, textAlign: 'center' },
});
