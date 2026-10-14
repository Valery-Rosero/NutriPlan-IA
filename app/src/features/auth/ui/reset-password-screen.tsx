import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useUpdatePassword } from '@/features/auth/application/use-auth';
import { newPasswordFormSchema } from '@/features/auth/domain/schemas';
import { AuthScaffold } from '@/features/auth/ui/auth-scaffold';
import { PasswordRules } from '@/features/auth/ui/password-rules';
import { useLinkCode } from '@/features/auth/ui/use-link-code';
import { AppText, Banner, Button, FormTextField, LoadingState, Screen } from '@/shared/ui';

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
  const password = useWatch({ control, name: 'password' });

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
      <AuthScaffold icon="time-outline" title={t('auth.reset.expiredTitle')}>
        <Banner tone="warning" message={t('errors.link_expired')} />
        <Button label={t('auth.reset.requestNew')} onPress={() => router.replace('/forgot-password')} />
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold icon="lock-open-outline" title={t('auth.reset.title')}>
      <FormTextField
        control={control}
        name="password"
        label={t('auth.reset.password')}
        icon="lock-closed-outline"
        secure
        autoComplete="new-password"
      />
      <PasswordRules value={password} />
      <FormTextField
        control={control}
        name="confirm"
        label={t('auth.reset.confirm')}
        icon="lock-closed-outline"
        secure
        autoComplete="new-password"
      />
      {update.error && <Banner tone="danger" message={t(errorKey(update.error))} />}
      <Button
        label={t('auth.reset.submit')}
        loading={update.isPending}
        onPress={handleSubmit(({ password: next }) => update.mutate(next, { onSuccess: () => router.replace('/') }))}
      />
    </AuthScaffold>
  );
}
