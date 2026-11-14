import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { DictationError } from '@/shared/voice/use-dictation';
import { Spacing } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';
import { IconButton } from '@/shared/ui/icon-button';
import { AppText } from '@/shared/ui/primitives';

/** Micrófono junto al campo (como WhatsApp): toca para dictar, toca otra vez para terminar. */
export function DictateButton({ listening, onStart, onStop, disabled }: {
  listening: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <IconButton
      icon={listening ? 'stop-circle' : 'mic-outline'}
      tone={listening ? 'danger' : 'berry'}
      size={listening ? 28 : 24}
      label={listening ? t('voice.stop') : t('voice.start')}
      disabled={disabled}
      onPress={listening ? onStop : onStart}
    />
  );
}

/** "Te escucho…" mientras dicta, o qué pasó si no se pudo (escrito, no solo con color). */
export function DictationStatus({ listening, error }: { listening: boolean; error: DictationError | null }) {
  const { t } = useTranslation();
  const c = useTheme();
  if (!listening && !error) return null;
  return (
    <View style={styles.row} accessibilityLiveRegion="polite">
      <AppText variant="caption" style={{ color: listening ? c.berry : c.danger }}>
        {listening ? t('voice.listening') : t(`voice.errors.${error}`)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({ row: { paddingHorizontal: Spacing.xs } });
