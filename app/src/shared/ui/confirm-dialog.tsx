import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/shared/theme/colors';
import { elevation, Radius } from '@/shared/theme/tokens';
import { useTheme } from '@/shared/theme/use-theme';
import { IconBadge, type Tone } from './display';
import { AppText, Button, type IconName } from './primitives';

/**
 * Diálogo con el diseño de la app (reemplaza a Alert.alert, que en Android se ve como el del sistema).
 * - Con `cancelLabel`: confirmación (dos botones). Sin él: aviso con un solo botón.
 * - `danger` para acciones que borran o cierran algo: el botón principal va en rojo.
 * - El botón "atrás" de Android y tocar fuera equivalen a cancelar.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  danger,
  icon,
  loading,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
  icon?: IconName;
  loading?: boolean;
}) {
  const c = useTheme();
  const tone: Tone = danger ? 'danger' : 'primary';
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <View style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.scrim]}
          onPress={loading ? undefined : onCancel}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel ?? confirmLabel}
          importantForAccessibility="no"
        />
        <View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={[styles.card, { backgroundColor: c.card, borderColor: c.divider }, elevation(2, c.shadow)]}>
          {icon && <IconBadge name={icon} tone={tone} />}
          <AppText variant="heading">{title}</AppText>
          {message ? <AppText secondary>{message}</AppText> : null}
          <View style={styles.actions}>
            <Button label={confirmLabel} variant={danger ? 'danger' : 'primary'} loading={loading} onPress={onConfirm} />
            {cancelLabel ? <Button label={cancelLabel} variant="ghost" disabled={loading} onPress={onCancel} /> : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: Spacing.lg },
  scrim: { backgroundColor: 'rgba(12, 18, 30, 0.55)' },
  card: { borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.lg, gap: Spacing.md, maxWidth: 440, width: '100%', alignSelf: 'center' },
  actions: { gap: Spacing.sm, paddingTop: Spacing.xs },
});
