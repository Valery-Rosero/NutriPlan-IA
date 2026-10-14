import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey, toAppError } from '@/core/errors/app-error';
import { useResendConfirmation, useSignIn } from '@/features/auth/application/use-auth';
import { signInFormSchema } from '@/features/auth/domain/schemas';
import { AuthDivider, AuthScaffold } from '@/features/auth/ui/auth-scaffold';
import { Spacing } from '@/shared/theme/colors';
import { Banner, Button, FormTextField, TextLink } from '@/shared/ui';

/** US-104: inicio de sesión. Al tener sesión, el navegador raíz lleva a la app (no se navega aquí). */
export function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const signIn = useSignIn();
  const resend = useResendConfirmation();

  const { control, handleSubmit, getValues } = useForm({
    resolver: zodResolver(signInFormSchema),
    defaultValues: { email: params.email ?? '', password: '' },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit((credentials) => signIn.mutate(credentials));
  const error = signIn.error ? toAppError(signIn.error) : null;

  const resendConfirmation = () => {
    const email = getValues('email');
    resend.mutate(email, {
      onSuccess: () => router.replace({ pathname: '/verify-email', params: { email } }),
    });
  };

  return (
    <AuthScaffold icon="log-in-outline" title={t('auth.signIn.title')} subtitle={t('auth.signIn.subtitle')}>
      <FormTextField
        control={control}
        name="email"
        label={t('auth.signUp.email')}
        icon="mail-outline"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <FormTextField
        control={control}
        name="password"
        label={t('auth.signUp.password')}
        icon="lock-closed-outline"
        secure
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={onSubmit}
      />
      <View style={styles.forgot}>
        <TextLink label={t('auth.signIn.forgot')} onPress={() => router.push('/forgot-password')} />
      </View>

      {error && <Banner tone="danger" message={t(errorKey(error))} />}
      {error?.code === 'email_not_confirmed' && (
        <Button
          label={t('auth.signIn.resend')}
          variant="secondary"
          icon="mail-unread-outline"
          onPress={resendConfirmation}
          loading={resend.isPending}
        />
      )}
      {resend.error && <Banner tone="danger" message={t(errorKey(resend.error))} />}

      <Button label={t('auth.signIn.submit')} onPress={onSubmit} loading={signIn.isPending} />
      <AuthDivider label={t('auth.signIn.newHere')} />
      <Button label={t('auth.signIn.createAccount')} variant="secondary" onPress={() => router.replace('/sign-up')} />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  forgot: { alignItems: 'flex-end', marginTop: -Spacing.sm },
});
