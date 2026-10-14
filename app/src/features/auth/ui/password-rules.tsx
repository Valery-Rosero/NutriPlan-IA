import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { passwordChecks } from '@/features/auth/domain/schemas';
import { Spacing } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';
import { AppText } from '@/shared/ui';

/** Reglas de la contraseña que se van marcando mientras se escribe (en vez de un error al final). */
export function PasswordRules({ value }: { value: string }) {
  const { t } = useTranslation();
  const c = useTheme();
  return (
    <View style={styles.list}>
      {passwordChecks(value).map(({ key, ok }) => {
        const text = t(`auth.rules.${key}`);
        return (
          <View
            key={key}
            accessible
            accessibilityLabel={`${t(ok ? 'auth.rules.met' : 'auth.rules.pending')}: ${text}`}
            style={styles.row}>
            <Ionicons
              name={ok ? 'checkmark-circle' : 'ellipse-outline'}
              size={18}
              color={ok ? c.primary : c.textSecondary}
            />
            <AppText variant="caption" tone={ok ? 'primary' : 'default'} secondary={!ok}>{text}</AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.xs, marginTop: -Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
