import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { errorKey, toAppError } from '@/core/errors/app-error';
import { useResendConfirmation, useSignIn } from '@/features/auth/application/use-auth';
import { signInFormSchema } from '@/features/auth/domain/schemas';
import { AppText, Banner, Button, FormTextField, Screen, TextLink } from '@/shared/ui';

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
    <Screen scroll>
      <AppText variant="title">{t('auth.signIn.title')}</AppText>
      <FormTextField
        control={control}
        name="email"
        label={t('auth.signUp.email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <FormTextField
        control={control}
        name="password"
        label={t('auth.signUp.password')}
        secure
        autoComplete="current-password"
        textContentType="password"
      />

      {error && <Banner tone="danger" message={t(errorKey(error))} />}
      {error?.code === 'email_not_confirmed' && (
        <Button label={t('auth.signIn.resend')} variant="secondary" onPress={resendConfirmation} loading={resend.isPending} />
      )}
      {resend.error && <Banner tone="danger" message={t(errorKey(resend.error))} />}

      <Button label={t('auth.signIn.submit')} onPress={onSubmit} loading={signIn.isPending} />
      <TextLink label={t('auth.signIn.forgot')} onPress={() => router.push('/forgot-password')} />
      <TextLink label={t('auth.signIn.noAccount')} onPress={() => router.replace('/sign-up')} />
    </Screen>
  );
}
