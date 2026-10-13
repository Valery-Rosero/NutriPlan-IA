import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useRequestPasswordReset } from '@/features/auth/application/use-auth';
import { emailFormSchema } from '@/features/auth/domain/schemas';
import { AppText, Banner, Button, FormTextField, Screen } from '@/shared/ui';

export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const reset = useRequestPasswordReset();
  const { control, handleSubmit } = useForm({
    resolver: zodResolver(emailFormSchema),
    defaultValues: { email: '' },
    mode: 'onTouched',
  });

  return (
    <Screen scroll>
      <AppText variant="title">{t('auth.forgot.title')}</AppText>
      <AppText secondary>{t('auth.forgot.body')}</AppText>
      <FormTextField
        control={control}
        name="email"
        label={t('auth.signUp.email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      {/* Mismo mensaje exista o no la cuenta: no se revela qué correos están registrados. */}
      {reset.isSuccess && <Banner tone="success" message={t('auth.forgot.sent')} />}
      {reset.error && <Banner tone="danger" message={t(errorKey(reset.error))} />}
      <Button
        label={t('auth.forgot.submit')}
        loading={reset.isPending}
        onPress={handleSubmit(({ email }) => reset.mutate(email))}
      />
    </Screen>
  );
}
