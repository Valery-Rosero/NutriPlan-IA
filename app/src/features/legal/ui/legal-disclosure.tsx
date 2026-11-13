import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useLegalText } from '@/features/legal/application/legal-queries';
import type { LegalDocKind } from '@/features/legal/domain/legal';
import { MinTouch, Spacing } from '@/shared/theme/colors';
import { Radius, Typography } from '@/shared/theme/tokens';
import { useTheme } from '@/shared/theme/use-theme';
import { ErrorState, LoadingState, MarkdownText } from '@/shared/ui';

/**
 * Documento legal que se despliega ahí mismo (registro): se lee sin salir del formulario, así no se pierde
 * lo escrito. El texto va en un cuadro con su propio desplazamiento para no alargar la pantalla sin fin.
 */
export function LegalDisclosure({ kind, label }: { kind: LegalDocKind; label: string }) {
  const [open, setOpen] = useState(false);
  const c = useTheme();
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        hitSlop={4}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
        <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={18} color={c.primary} />
        <Text style={[Typography.label, styles.flex, { color: c.primary }]}>{label}</Text>
      </Pressable>
      {open && <LegalBody kind={kind} />}
    </View>
  );
}

function LegalBody({ kind }: { kind: LegalDocKind }) {
  const { t } = useTranslation();
  const c = useTheme();
  const { text, isPending, error } = useLegalText(kind);
  return (
    <View style={[styles.box, { borderColor: c.border, backgroundColor: c.card }]}>
      {isPending ? (
        <LoadingState />
      ) : error || !text.data ? (
        <ErrorState message={t(errorKey(error))} onRetry={() => void text.refetch()} />
      ) : (
        // nestedScrollEnabled: en Android un desplazamiento dentro de otro necesita permiso explícito.
        <ScrollView nestedScrollEnabled style={styles.scroll} contentContainerStyle={styles.content}>
          <MarkdownText source={text.data} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, minHeight: MinTouch },
  pressed: { opacity: 0.6 },
  flex: { flex: 1 },
  box: { borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden' },
  scroll: { maxHeight: 320 },
  content: { padding: Spacing.md },
});
