import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Spacing } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';
import { AppText } from '@/shared/ui/primitives';

/**
 * Notas de voz, opción A (pendientes B6-3): el teclado del teléfono ya dicta (micrófono de Gboard). Se recuerda
 * donde se escribe de corrido, sin permisos ni costo. Un botón propio de grabación solo si esto no basta.
 */
export function DictationHint() {
  const { t } = useTranslation();
  const c = useTheme();
  return (
    <View style={styles.row}>
      <Ionicons name="mic-outline" size={16} color={c.textSecondary} importantForAccessibility="no" accessibilityElementsHidden />
      <AppText variant="caption" secondary style={styles.flex}>{t('common.dictationHint')}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  flex: { flex: 1 },
});
