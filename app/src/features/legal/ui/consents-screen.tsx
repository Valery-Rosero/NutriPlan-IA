import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useSession } from '@/features/auth/application/session';
import { useSignOut } from '@/features/auth/application/use-auth';
import { useAcceptConsents, useRequiredConsents } from '@/features/legal/application/legal-queries';
import { legalHref } from '@/features/legal/ui/legal-href';
import { AppText, Banner, Button, Checkbox, ErrorState, LoadingState, Screen, TextLink } from '@/shared/ui';

/**
 * Puerta de entrada: documentos que faltan por aceptar (versiones nuevas de privacidad/términos
 * y el aviso de salud de US-114). Al aceptarlos, el navegador raíz abre la app.
 */
export function ConsentsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useSession();
  const required = useRequiredConsents(session?.userId);
  const accept = useAcceptConsents();
  const signOut = useSignOut();
  const [checked, setChecked] = useState<Set<number>>(new Set());

  if (required.isPending) return <Screen><LoadingState /></Screen>;
  if (required.isError) {
    return <Screen><ErrorState message={t(errorKey(required.error))} onRetry={() => required.refetch()} /></Screen>;
  }

  const documents = required.data;
  const allChecked = documents.every((d) => checked.has(d.id));
  const toggle = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Screen scroll>
      <AppText variant="title">{t('legal.consents.title')}</AppText>
      <AppText secondary>{t('legal.consents.body')}</AppText>
      {documents.some((d) => d.version > 1) && <Banner tone="info" message={t('legal.consents.updated')} />}

      {documents.map((doc) => {
        const name = t(`legal.kinds.${doc.kind}`);
        return (
          <Checkbox
            key={doc.id}
            checked={checked.has(doc.id)}
            onChange={() => toggle(doc.id)}
            label={t('legal.acceptDoc', { name })}>
            <TextLink label={`${t('common.read')}: ${name}`} onPress={() => router.push(legalHref(doc.kind))} />
          </Checkbox>
        );
      })}

      {accept.error && <Banner tone="danger" message={t(errorKey(accept.error))} />}
      <Button
        label={t('legal.consents.accept')}
        disabled={!allChecked}
        loading={accept.isPending}
        onPress={() => accept.mutate(documents.map((d) => d.id))}
      />
      <TextLink label={t('legal.consents.signOut')} onPress={() => signOut.mutate()} />
    </Screen>
  );
}
