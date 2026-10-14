import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTranslation } from 'react-i18next';

import { MinTouch, Spacing } from '@/shared/theme/colors';
import { Radius, Typography } from '@/shared/theme/tokens';
import { useTheme } from '@/shared/theme/use-theme';

type FieldProps = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  /** Clave i18n del error (los esquemas Zod devuelven claves, no textos). */
  error?: string;
  secure?: boolean;
};

/** Campo de texto con etiqueta visible y error asociado y anunciado por el lector de pantalla. */
export function TextField({ label, error, secure, style, ...input }: FieldProps) {
  const { t } = useTranslation();
  const c = useTheme();
  const [hidden, setHidden] = useState(true);
  const message = error ? t(error) : undefined;
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      <View style={[styles.inputRow, { borderColor: message ? c.danger : c.border, backgroundColor: c.surface }]}>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={message}
          placeholderTextColor={c.textSecondary}
          secureTextEntry={secure && hidden}
          style={[styles.input, { color: c.text }, style]}
          {...input}
        />
        {secure && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(hidden ? 'common.showPassword' : 'common.hidePassword')}
            onPress={() => setHidden((h) => !h)}
            style={styles.eye}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={22} color={c.textSecondary} />
          </Pressable>
        )}
      </View>
      {message && (
        <Text accessibilityLiveRegion="polite" style={[styles.error, { color: c.danger }]}>
          {message}
        </Text>
      )}
    </View>
  );
}

/** Casilla accesible. Nunca arranca marcada si representa un consentimiento. */
export function Checkbox({ checked, onChange, label, error, children }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  error?: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  const message = error ? t(error) : undefined;
  return (
    <View style={styles.field}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        accessibilityHint={message}
        onPress={() => onChange(!checked)}
        style={styles.checkRow}>
        <View style={[styles.box, { borderColor: message ? c.danger : c.primary, backgroundColor: checked ? c.primary : 'transparent' }]}>
          {checked && <Ionicons name="checkmark" size={18} color={c.onPrimary} />}
        </View>
        <Text style={[styles.checkLabel, { color: c.text }]}>{label}</Text>
      </Pressable>
      {children}
      {message && <Text style={[styles.error, { color: c.danger }]}>{message}</Text>}
    </View>
  );
}

// ---- Integración con React Hook Form (adaptadores finos) ----
type ControlledProps<T extends FieldValues> = { control: Control<T>; name: FieldPath<T> };

export function FormTextField<T extends FieldValues>({ control, name, ...props }: ControlledProps<T> &
  Omit<FieldProps, 'value' | 'onChangeText' | 'error'>) {
  const { field, fieldState } = useController({ control, name });
  return (
    <TextField
      {...props}
      value={(field.value as string | undefined) ?? ''}
      onChangeText={field.onChange}
      onBlur={field.onBlur}
      error={fieldState.error?.message}
    />
  );
}

export function FormCheckbox<T extends FieldValues>({ control, name, label, children }: ControlledProps<T> & {
  label: string;
  children?: ReactNode;
}) {
  const { field, fieldState } = useController({ control, name });
  return (
    <Checkbox checked={!!field.value} onChange={field.onChange} label={label} error={fieldState.error?.message}>
      {children}
    </Checkbox>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.xs },
  label: Typography.label,
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: Radius.md },
  input: { flex: 1, minHeight: MinTouch + 4, paddingHorizontal: Spacing.md, fontSize: 16 },
  eye: { minWidth: MinTouch, minHeight: MinTouch, alignItems: 'center', justifyContent: 'center' },
  error: Typography.caption,
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: MinTouch },
  box: { width: 26, height: 26, borderRadius: Radius.sm - 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkLabel: { ...Typography.body, flex: 1 },
});
