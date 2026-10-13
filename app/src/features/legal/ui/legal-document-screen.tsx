import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/core/errors/app-error';
import { useLegalText } from '@/features/legal/application/legal-queries';
import type { LegalDocKind } from '@/features/legal/domain/legal';
import { Banner, ErrorState, LoadingState, MarkdownText, Screen } from '@/shared/ui';

export function LegalDocumentScreen() {
  const { t } = useTranslation();
  const { kind } = useLocalSearchParams<{ kind: LegalDocKind }>();
  const { document, text, isPending, error } = useLegalText(kind);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t(`legal.kinds.${kind}`) }} />
      <Screen scroll>
        {isPending ? (
          <LoadingState />
        ) : error || !text.data ? (
          <ErrorState message={t(errorKey(error))} onRetry={() => text.refetch()} />
        ) : (
          <>
            {!document?.contentUrl && <Banner tone="warning" message={t('legal.draft')} />}
            <MarkdownText source={text.data} />
          </>
        )}
      </Screen>
    </>
  );
}
