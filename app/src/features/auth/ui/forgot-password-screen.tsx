import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useRequestPasswordReset } from '@/features/auth/application/use-auth';
import { emailFormSchema } from '@/features/auth/domain/schemas';
import { AuthScaffold } from '@/features/auth/ui/auth-scaffold';
import { Banner, Button, FormTextField } from '@/shared/ui';

export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const reset = useRequestPasswordReset();
  const { control, handleSubmit } = useForm({
    resolver: zodResolver(emailFormSchema),
    defaultValues: { email: '' },
    mode: 'onTouched',
  });
  const onSubmit = handleSubmit(({ email }) => reset.mutate(email));

  return (
    <AuthScaffold icon="key-outline" title={t('auth.forgot.title')} subtitle={t('auth.forgot.body')}>
      <FormTextField
        control={control}
        name="email"
        label={t('auth.signUp.email')}
        icon="mail-outline"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        onSubmitEditing={onSubmit}
      />
      {/* Mismo mensaje exista o no la cuenta: no se revela qué correos están registrados. */}
      {reset.isSuccess && <Banner tone="success" message={t('auth.forgot.sent')} />}
      {reset.error && <Banner tone="danger" message={t(errorKey(reset.error))} />}
      <Button label={t('auth.forgot.submit')} icon="paper-plane-outline" loading={reset.isPending} onPress={onSubmit} />
    </AuthScaffold>
  );
}
