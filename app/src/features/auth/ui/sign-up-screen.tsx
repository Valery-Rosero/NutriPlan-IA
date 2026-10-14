import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useForm, useWatch } from 'react-hook-form';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey, toAppError } from '@/core/errors/app-error';
import { useSignUp } from '@/features/auth/application/use-auth';
import { signUpFormSchema } from '@/features/auth/domain/schemas';
import { AuthScaffold } from '@/features/auth/ui/auth-scaffold';
import { PasswordRules } from '@/features/auth/ui/password-rules';
import { registrationNotice } from '@/features/legal/data/legal-drafts.generated';
import { useCurrentDocuments } from '@/features/legal/application/legal-queries';
import { legalHref } from '@/features/legal/ui/legal-href';
import { Spacing } from '@/shared/theme/colors';
import { AppText, Banner, Button, Card, FormCheckbox, FormTextField, MarkdownText, TextLink } from '@/shared/ui';

/** US-104 + US-113: registro con casillas NO premarcadas y aviso de privacidad visible. */
export function SignUpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const signUp = useSignUp();
  useCurrentDocuments(); // los ids vigentes quedan en caché antes de enviar

  const { control, handleSubmit, getValues } = useForm({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: { email: '', password: '', isAdult: false, acceptTerms: false, acceptPrivacy: false },
    mode: 'onTouched',
  });
  const password = useWatch({ control, name: 'password' });

  const onSubmit = handleSubmit((form) =>
    signUp.mutate(form, {
      onSuccess: (outcome) => {
        if (outcome === 'confirmation_sent') router.replace({ pathname: '/verify-email', params: { email: form.email } });
      },
    }),
  );

  const error = signUp.error ? toAppError(signUp.error) : null;

  return (
    <AuthScaffold icon="person-add-outline" title={t('auth.signUp.title')} subtitle={t('auth.signUp.subtitle')}>
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
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <PasswordRules value={password} />

      {/* El aviso de privacidad queda junto a las casillas que autoriza (US-113). */}
      <Card variant="filled" style={styles.legal}>
        <AppText variant="heading">{t('auth.signUp.legalTitle')}</AppText>
        <MarkdownText source={registrationNotice} />
        <FormCheckbox control={control} name="isAdult" label={t('auth.signUp.isAdult')} />
        <FormCheckbox control={control} name="acceptTerms" label={t('auth.signUp.acceptTerms')}>
          <TextLink label={t('auth.signUp.readTerms')} onPress={() => router.push(legalHref('terms'))} />
        </FormCheckbox>
        <FormCheckbox control={control} name="acceptPrivacy" label={t('auth.signUp.acceptPrivacy')}>
          <TextLink label={t('auth.signUp.readPrivacy')} onPress={() => router.push(legalHref('privacy_policy'))} />
        </FormCheckbox>
      </Card>

      {error && <Banner tone="danger" message={t(errorKey(error))} />}
      {error?.code === 'email_taken' && (
        <TextLink
          label={t('auth.signUp.emailTakenAction')}
          onPress={() => router.replace({ pathname: '/sign-in', params: { email: getValues('email') } })}
        />
      )}

      <Button label={t('auth.signUp.submit')} onPress={onSubmit} loading={signUp.isPending} />
      <TextLink label={t('auth.signUp.haveAccount')} onPress={() => router.replace('/sign-in')} />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  legal: { gap: Spacing.md },
});
