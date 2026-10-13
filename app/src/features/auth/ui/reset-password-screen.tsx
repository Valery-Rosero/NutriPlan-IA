import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useUpdatePassword } from '@/features/auth/application/use-auth';
import { newPasswordFormSchema } from '@/features/auth/domain/schemas';
import { useLinkCode } from '@/features/auth/ui/use-link-code';
import { AppText, Banner, Button, FormTextField, LoadingState, Screen, TextLink } from '@/shared/ui';

/** Destino del enlace de recuperación: canjea el código y permite fijar una contraseña nueva. */
export function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const link = useLinkCode();
  const update = useUpdatePassword();
  const { control, handleSubmit } = useForm({
    resolver: zodResolver(newPasswordFormSchema),
    defaultValues: { password: '', confirm: '' },
    mode: 'onTouched',
  });

  if (link.verifying) {
    return (
      <Screen>
        <AppText variant="subtitle">{t('auth.reset.verifying')}</AppText>
        <LoadingState />
      </Screen>
    );
  }

  if (link.failed) {
    return (
      <Screen>
        <Banner tone="warning" message={t('errors.link_expired')} />
        <TextLink label={t('auth.signIn.forgot')} onPress={() => router.replace('/forgot-password')} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <AppText variant="title">{t('auth.reset.title')}</AppText>
      <FormTextField control={control} name="password" label={t('auth.reset.password')} secure autoComplete="new-password" />
      <FormTextField control={control} name="confirm" label={t('auth.reset.confirm')} secure autoComplete="new-password" />
      <AppText variant="caption" secondary>{t('auth.signUp.passwordHint')}</AppText>
      {update.error && <Banner tone="danger" message={t(errorKey(update.error))} />}
      <Button
        label={t('auth.reset.submit')}
        loading={update.isPending}
        onPress={handleSubmit(({ password }) => update.mutate(password, { onSuccess: () => router.replace('/') }))}
      />
    </Screen>
  );
}
